import { prisma } from "@/lib/prisma";

/**
 * บันทึกการเพิ่ม/ใช้เครดิตของลูกค้า — อัปเดต Customer.creditBalance (ยอดรวมที่คำนวณไว้ล่วงหน้า) กับแถวประวัติ
 * CustomerCredit พร้อมกันเสมอในทรานแซกชันเดียว ห้ามแก้ creditBalance ตรงๆ ที่อื่นเด็ดขาด ไม่งั้นยอดรวมเพี้ยนจากประวัติ
 *
 * amount: บวก = ให้เครดิตเพิ่ม (เช่น ลูกค้ายกเลิกออเดอร์ที่จ่ายไปแล้วแล้วเลือกเก็บเป็นเครดิตแทนคืนเงิน)
 *         ลบ = หักเครดิตไปใช้ (เช่น หักกับออเดอร์ใหม่) — ฟังก์ชันนี้ไม่เช็คว่ายอดจะติดลบไหม ผู้เรียกต้องเช็คเองก่อน
 */
export async function recordCustomerCredit(params: {
  customerId: string;
  amount: number;
  reason: string;
  orderId?: string | null;
  createdById?: string | null;
}): Promise<void> {
  await prisma.$transaction([
    prisma.customer.update({
      where: { id: params.customerId },
      data: { creditBalance: { increment: params.amount } },
    }),
    prisma.customerCredit.create({
      data: {
        customerId: params.customerId,
        amount: params.amount,
        reason: params.reason,
        orderId: params.orderId ?? null,
        createdById: params.createdById ?? null,
      },
    }),
  ]);
}
