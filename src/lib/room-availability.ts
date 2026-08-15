import { prisma } from "@/lib/prisma";
import { isSlotHolding } from "@/lib/booking";

/**
 * ห้อง/คอก/พื้นที่นี้ว่างในช่วง checkInAt–checkOutAt หรือไม่
 * เช็คเฉพาะออเดอร์ที่ "กันคิว" อยู่ในห้องเดียวกันเท่านั้น (ไม่ใช่คิวส่วนกลาง)
 * ใช้ half-open interval overlap: [checkInAt, checkOutAt) ทับกับของเดิมหรือไม่
 * เวลาเช็คอิน/เช็คเอาท์มีทั้งวันและเวลา จึงรองรับ Daycare/Pawsome หลายรอบวันเดียวกัน
 * ในห้องเดียวกันได้เองโดยไม่ต้องเช็คพิเศษ ตราบใดที่ช่วงเวลาไม่ทับกัน
 */
export async function isRoomAvailable(
  roomId: string,
  checkInAt: Date,
  checkOutAt: Date,
  excludeOrderId?: string
): Promise<boolean> {
  const candidates = await prisma.order.findMany({
    where: {
      roomId,
      id: excludeOrderId ? { not: excludeOrderId } : undefined,
      checkInAt: { lt: checkOutAt },
      checkOutAt: { gt: checkInAt },
    },
    select: {
      status: true,
      payments: { select: { status: true, expiresAt: true } },
    },
  });
  return !candidates.some((o) => isSlotHolding(o));
}
