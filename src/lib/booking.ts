import type { OrderStatus, PaymentStatus } from "@/generated/prisma/enums";
import { prisma } from "@/lib/prisma";
import {
  TIME_SLOTS,
  buildSlotDate,
  isPastSlot,
  isValidDateStr,
  isValidTimeStr,
  thaiDayRange,
  toThaiTimeStr,
} from "@/lib/slots";

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
    // รอเช็คคิว = ลูกค้าจองไว้แล้วรอพนักงานยืนยัน ต้องกันคิวไว้ ไม่งั้นคนอื่นจองทับระหว่างรอ
    o.status === "PENDING_APPROVAL" ||
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

/**
 * เช็คว่า slot คิวส่วนกลางนี้ว่างไหม (ไม่มีออเดอร์ที่ "กันคิว" อยู่)
 * แยกพูลคิวตาม queueType (BATH = จองอาบน้ำ, OTHER = จองบริการอื่นๆ) ไม่แย่งเวลากัน
 * ออเดอร์เก่าก่อนมีฟีเจอร์นี้ (queueType เป็น null) ถือเป็นพูล BATH
 */
export async function isSlotAvailable(
  dateStr: string,
  timeStr: string,
  excludeOrderId?: string,
  queueType: "BATH" | "OTHER" = "BATH"
): Promise<boolean> {
  if (!isValidDateStr(dateStr) || !isValidTimeStr(timeStr)) return false;
  const at = buildSlotDate(dateStr, timeStr);
  const orders = await prisma.order.findMany({
    where: {
      appointmentAt: at,
      ...(queueType === "BATH" ? { OR: [{ queueType: "BATH" }, { queueType: null }] } : { queueType: "OTHER" }),
      ...(excludeOrderId ? { id: { not: excludeOrderId } } : {}),
    },
    select: {
      status: true,
      payments: { select: { status: true, expiresAt: true } },
    },
  });
  return !orders.some((o) => isSlotHolding(o));
}

/**
 * ช่วงเวลาสำเร็จรูป "แรกของวันนั้น" ที่ยังจองได้ — ไม่ผ่านมาแล้ว และไม่มีใครกันคิวไว้
 * คืน null ถ้าเต็มหมดทั้งวัน
 *
 * ใช้เป็นเวลาตั้งต้นให้ปุ่มเปิดออเดอร์ในหน้าปฏิทิน เพราะ /orders/new บังคับว่าต้องมีทั้งวันและเวลา
 * ถึงจะเข้าฟอร์มได้ (ไม่งั้นเด้งกลับปฏิทิน) — พนักงานยังแก้เวลาในฟอร์มต่อได้เอง
 *
 * ดึงออเดอร์ของทั้งวันมาทีเดียวแล้วค่อยไล่เทียบ แทนที่จะเรียก isSlotAvailable ทีละช่วง
 * (ซึ่งจะกลายเป็น query เท่าจำนวนช่วงเวลา) แต่ยังตัดสิน "กันคิวอยู่ไหม" ด้วย isSlotHolding ตัวเดิม
 */
export async function firstOpenSlot(
  dateStr: string,
  queueType: "BATH" | "OTHER" = "BATH"
): Promise<string | null> {
  if (!isValidDateStr(dateStr)) return null;
  const { start, end } = thaiDayRange(dateStr);
  const orders = await prisma.order.findMany({
    where: {
      appointmentAt: { gte: start, lt: end },
      ...(queueType === "BATH" ? { OR: [{ queueType: "BATH" }, { queueType: null }] } : { queueType: "OTHER" }),
    },
    select: {
      appointmentAt: true,
      status: true,
      payments: { select: { status: true, expiresAt: true } },
    },
  });
  const taken = new Set(
    orders.filter((o) => isSlotHolding(o)).map((o) => toThaiTimeStr(o.appointmentAt!))
  );
  return TIME_SLOTS.find((slot) => !taken.has(slot) && !isPastSlot(dateStr, slot)) ?? null;
}
