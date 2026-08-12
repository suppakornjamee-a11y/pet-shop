import type { OrderStatus, PaymentStatus } from "@/generated/prisma/enums";

export type OrderForHold = {
  status: OrderStatus;
  payment: { status: PaymentStatus; expiresAt: Date | null } | null;
};

/**
 * ออเดอร์นี้ "กันคิว" อยู่หรือไม่
 * - ชำระแล้ว/กำลังทำ/เสร็จสิ้น  → กันแน่นอน (จ่ายเงินแล้ว)
 * - รอชำระ + สลิปส่งแล้ว/ยังไม่หมดอายุ → กันชั่วคราว
 * - ยกเลิก / ปฏิเสธ / QR หมดอายุแต่ยังไม่จ่าย → ไม่กัน (คืนคิว)
 */
export function isSlotHolding(o: OrderForHold, now: Date = new Date()): boolean {
  if (o.status === "CANCELLED") return false;
  if (o.status === "PAID" || o.status === "IN_PROGRESS" || o.status === "COMPLETED") {
    return true;
  }
  // PENDING_PAYMENT
  const p = o.payment;
  if (!p) return true; // เผื่อไม่มี payment (ไม่ควรเกิด) — กันไว้ก่อน
  if (p.status === "REJECTED") return false;
  if (p.status === "PENDING" && p.expiresAt && p.expiresAt.getTime() < now.getTime()) {
    return false; // QR หมดอายุและยังไม่ได้จ่าย → คืนคิว
  }
  return true; // PENDING (ยังไม่หมดอายุ) หรือ SUBMITTED → กันชั่วคราว
}
