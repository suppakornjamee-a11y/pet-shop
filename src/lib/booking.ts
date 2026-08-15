import type { OrderStatus, PaymentStatus } from "@/generated/prisma/enums";

export type OrderForHold = {
  status: OrderStatus;
  payments: { status: PaymentStatus; expiresAt: Date | null }[];
};

/**
 * ออเดอร์นี้ "กันคิว" อยู่หรือไม่
 * - ชำระแล้ว/มัดจำแล้ว/กำลังทำ/เสร็จสิ้น → กันแน่นอน
 * - รอชำระ + มี payment ที่ยืนยันแล้ว/ส่งสลิปแล้ว/ยังไม่หมดอายุ → กันชั่วคราว
 * - ยกเลิก หรือไม่มี payment ไหนกันคิวอยู่เลย → ไม่กัน (คืนคิว)
 */
export function isSlotHolding(o: OrderForHold, now: Date = new Date()): boolean {
  if (o.status === "CANCELLED") return false;
  if (
    o.status === "PAID" ||
    o.status === "DEPOSIT_PAID" ||
    o.status === "IN_PROGRESS" ||
    o.status === "COMPLETED"
  ) {
    return true;
  }
  // PENDING_PAYMENT
  if (o.payments.length === 0) return true; // เผื่อไม่มี payment เลย (ไม่ควรเกิด) — กันไว้ก่อน
  return o.payments.some((p) => {
    if (p.status === "REJECTED") return false;
    if (p.status === "PENDING" && p.expiresAt && p.expiresAt.getTime() < now.getTime()) {
      return false; // QR หมดอายุและยังไม่ได้จ่าย
    }
    return true; // VERIFIED, SUBMITTED, หรือ PENDING ที่ยังไม่หมดอายุ → กันชั่วคราว
  });
}
