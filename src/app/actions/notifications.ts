"use server";

import { prisma } from "@/lib/prisma";
import { requireStaffUser } from "@/lib/auth-helpers";
import { formatDate, formatTime } from "@/lib/format";

/** งานที่รอพนักงานลงมือ — คิวใหม่ที่ต้องยืนยัน กับสลิปที่ลูกค้าส่งมาแล้วต้องตรวจ */
export type StaffAlertKind = "QUEUE" | "SLIP";

export type StaffAlert = {
  kind: StaffAlertKind;
  /** id ของออเดอร์ — ใช้ลิงก์เข้าไปจัดการ */
  orderId: string;
  /** คีย์ที่ไม่ซ้ำของแต่ละรายการ (ออเดอร์เดียวมีได้ทั้งคิวและสลิป) */
  key: string;
  code: string;
  customerName: string;
  petName: string | null;
  amount: number | null;
  at: string;
  /** เฉพาะรายการคิว (QUEUE) — วันเวลาที่ลูกค้าขอจอง ใช้ตัดสินใจว่าจัดคิวให้ได้ไหม (null สำหรับรายการสลิป) */
  when: string | null;
};

/** วันเวลาที่ลูกค้าขอจอง — คิวส่วนกลาง (อาบน้ำ/บริการอื่น) ใช้ appointmentAt, ห้องพักใช้ช่วงเช็คอิน–เช็คเอาท์ */
function requestedWhen(o: { appointmentAt: Date | null; checkInAt: Date | null; checkOutAt: Date | null }): string | null {
  if (o.checkInAt) {
    const inDate = formatDate(o.checkInAt);
    return o.checkOutAt ? `${inDate} – ${formatDate(o.checkOutAt)}` : inDate;
  }
  if (o.appointmentAt) return `${formatDate(o.appointmentAt)} ${formatTime(o.appointmentAt)} น.`;
  return null;
}

export type StaffAlerts = { count: number; items: StaffAlert[] };

/**
 * รายการที่รอพนักงานลงมือ — ใช้กับกระดิ่งแจ้งเตือนมุมขวาบน
 *
 * ใช้วิธีถามเป็นรอบ (polling) ไม่ใช่ push จริง เพราะระบบ deploy บน Vercel แบบ serverless
 * ซึ่งเปิด connection ค้างไว้ (WebSocket/SSE) ไม่ได้ ถ้าจะ push จริงต้องเช่าบริการข้างนอกซึ่งมีค่าใช้จ่าย
 * — งานหน้าร้านช้าได้ไม่กี่สิบวินาที จึงไม่คุ้มที่จะแลก
 */
export async function getStaffAlerts(): Promise<StaffAlerts> {
  const user = await requireStaffUser();
  // ช่างอาบน้ำยืนยันคิว/ตรวจสลิปไม่ได้อยู่แล้ว ไม่ต้องรบกวนด้วยตัวเลขที่กดอะไรไม่ได้
  if (user.role === "GROOMER") return { count: 0, items: [] };

  const [queues, slips] = await Promise.all([
    // ออเดอร์ที่รอเช็คคิว — รวมรายการในคำขอจองจาก LINE ด้วย (แอดมินอนุมัติทีละรายการ)
    prisma.order.findMany({
      where: { status: "PENDING_APPROVAL" },
      orderBy: { createdAt: "desc" },
      take: 10,
      select: {
        id: true,
        code: true,
        createdAt: true,
        appointmentAt: true,
        checkInAt: true,
        checkOutAt: true,
        customer: { select: { name: true } },
        pet: { select: { name: true } },
      },
    }),
    // สลิปที่ลูกค้าอัปโหลดมาแล้วยังไม่มีใครกดยืนยัน — ออเดอร์ที่ยกเลิกไปแล้วไม่ต้องเตือน
    prisma.payment.findMany({
      where: { status: "SUBMITTED", order: { status: { not: "CANCELLED" } } },
      orderBy: { submittedAt: "desc" },
      take: 10,
      select: {
        id: true,
        amount: true,
        submittedAt: true,
        createdAt: true,
        order: {
          select: {
            id: true,
            code: true,
            customer: { select: { name: true } },
            pet: { select: { name: true } },
          },
        },
      },
    }),
  ]);

  const items: StaffAlert[] = [
    ...queues.map((o) => ({
      kind: "QUEUE" as const,
      orderId: o.id,
      key: `queue-${o.id}`,
      code: o.code,
      customerName: o.customer?.name ?? "",
      petName: o.pet?.name ?? null,
      amount: null,
      at: o.createdAt.toISOString(),
      when: requestedWhen(o),
    })),
    ...slips.map((p) => ({
      kind: "SLIP" as const,
      orderId: p.order.id,
      key: `slip-${p.id}`,
      code: p.order.code,
      customerName: p.order.customer?.name ?? "",
      petName: p.order.pet?.name ?? null,
      amount: p.amount,
      at: (p.submittedAt ?? p.createdAt).toISOString(),
      when: null,
    })),
  ].sort((a, b) => b.at.localeCompare(a.at));

  return { count: items.length, items: items.slice(0, 10) };
}
