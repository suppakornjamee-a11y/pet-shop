"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireStaffUser } from "@/lib/auth-helpers";
import { buildLiffDeepLink, sendLinePush } from "@/lib/line";
import { createRequestPayment } from "@/lib/booking-request";
import { formatBaht } from "@/lib/format";
import type { ActionResult } from "./customers";

/**
 * การตัดสินใจของแอดมินต่อคำขอจองจาก LINE (ทั้งคำขอพร้อมกัน)
 * - อนุมัติ → ทุกรายการ "รอชำระเงิน" ออก QR ของทั้งคำขอ แจ้ง LINE ให้เข้าชำระ
 * - คิวไม่ว่าง → ทุกรายการ "รอเลือกวันเวลาใหม่" (ไม่กันคิว) ข้อมูลสัตว์และบริการยังอยู่ครบ ลูกค้าแก้วันแล้วส่งกลับ
 * - ยกเลิก → ยกเลิกจริงทั้งคำขอ
 */

function revalidateRequestViews(orderIds: string[]) {
  for (const id of orderIds) revalidatePath(`/orders/${id}`);
  revalidatePath("/orders/bath");
  revalidatePath("/orders/other");
  revalidatePath("/orders/boarding");
  revalidatePath("/boarding");
  revalidatePath("/calendar");
  revalidatePath("/calendar-other");
}

async function loadRequest(requestId: string) {
  return prisma.bookingRequest.findUnique({
    where: { id: requestId },
    include: {
      customer: { select: { lineUserId: true } },
      orders: { where: { status: { not: "CANCELLED" } }, select: { id: true } },
    },
  });
}

async function notify(lineUserId: string | null | undefined, text: string) {
  if (!lineUserId) return;
  try {
    await sendLinePush(lineUserId, text);
  } catch (e) {
    // ไม่ให้ LINE ล่มแล้วการอนุมัติพังตาม — บันทึกไว้ดูสาเหตุ
    console.error("[LINE] booking request push failed:", e);
  }
}

export async function approveBookingRequest(requestId: string): Promise<ActionResult> {
  const user = await requireStaffUser();
  const req = await loadRequest(requestId);
  if (!req) return { ok: false, error: "ไม่พบคำขอจอง" };
  if (req.status !== "PENDING_APPROVAL") return { ok: false, error: "คำขอนี้ไม่ได้อยู่ระหว่างรอตรวจสอบคิว" };
  const orderIds = req.orders.map((o) => o.id);
  if (orderIds.length === 0) return { ok: false, error: "คำขอนี้ไม่มีรายการที่ยังใช้งาน" };

  await prisma.$transaction([
    prisma.order.updateMany({ where: { id: { in: orderIds } }, data: { status: "PENDING_PAYMENT", updatedById: user.id } }),
    prisma.orderActivityLog.createMany({
      data: orderIds.map((orderId) => ({ orderId, action: `ยืนยันคิว (คำขอจอง ${req.code})`, createdById: user.id })),
    }),
    prisma.bookingRequest.update({
      where: { id: requestId },
      data: { status: "PENDING_DEPOSIT", approvedById: user.id, approvedAt: new Date(), rescheduleReason: null },
    }),
  ]);
  const payment = await createRequestPayment(requestId);

  const link = buildLiffDeepLink(`/requests/${requestId}`);
  await notify(
    req.customer.lineUserId,
    `✅ คิวว่างแล้วค่ะ\nคำขอจอง : ${req.code}\nยอดชำระ : ${formatBaht(payment.amount)}${link ? `\nชำระเงินที่ : ${link}` : ""}`
  );

  revalidateRequestViews(orderIds);
  return { ok: true, message: "อนุมัติคิวแล้ว" };
}

export async function requestBookingReschedule(requestId: string, reason: string): Promise<ActionResult> {
  const user = await requireStaffUser();
  const note = reason.trim();
  if (!note) return { ok: false, error: "กรุณาระบุเหตุผลที่คิวไม่ว่าง" };
  const req = await loadRequest(requestId);
  if (!req) return { ok: false, error: "ไม่พบคำขอจอง" };
  if (req.status !== "PENDING_APPROVAL") return { ok: false, error: "คำขอนี้ไม่ได้อยู่ระหว่างรอตรวจสอบคิว" };
  const orderIds = req.orders.map((o) => o.id);

  await prisma.$transaction([
    prisma.order.updateMany({ where: { id: { in: orderIds } }, data: { status: "RESCHEDULE_REQUIRED", updatedById: user.id } }),
    prisma.orderActivityLog.createMany({
      data: orderIds.map((orderId) => ({ orderId, action: `คิวไม่ว่าง ขอให้เลือกวันเวลาใหม่: ${note}`, createdById: user.id })),
    }),
    prisma.bookingRequest.update({ where: { id: requestId }, data: { status: "NEEDS_RESCHEDULE", rescheduleReason: note } }),
  ]);

  const link = buildLiffDeepLink(`/requests/${requestId}`);
  await notify(
    req.customer.lineUserId,
    `คิวที่เลือกไม่ว่างค่ะ\nคำขอจอง : ${req.code}\nเหตุผล : ${note}${link ? `\nเลือกวันเวลาใหม่ที่ : ${link}` : ""}`
  );

  revalidateRequestViews(orderIds);
  return { ok: true, message: "แจ้งลูกค้าให้เลือกวันเวลาใหม่แล้ว" };
}

export async function cancelBookingRequest(requestId: string, reason: string): Promise<ActionResult> {
  const user = await requireStaffUser();
  const note = reason.trim();
  if (!note) return { ok: false, error: "กรุณาระบุเหตุผลที่ยกเลิก" };
  const req = await prisma.bookingRequest.findUnique({
    where: { id: requestId },
    include: { orders: { select: { id: true, payments: { select: { status: true } } } } },
  });
  if (!req) return { ok: false, error: "ไม่พบคำขอจอง" };
  if (req.status === "CANCELLED") return { ok: false, error: "คำขอนี้ถูกยกเลิกไปแล้ว" };
  const orderIds = req.orders.map((o) => o.id);

  await prisma.$transaction([
    prisma.order.updateMany({ where: { id: { in: orderIds } }, data: { status: "CANCELLED", updatedById: user.id } }),
    prisma.orderActivityLog.createMany({
      data: orderIds.map((orderId) => ({ orderId, action: `ยกเลิกคำขอจอง: ${note}`, createdById: user.id })),
    }),
    prisma.bookingRequest.update({ where: { id: requestId }, data: { status: "CANCELLED", cancelReason: note } }),
  ]);

  revalidateRequestViews(orderIds);
  return { ok: true, message: "ยกเลิกคำขอจองแล้ว" };
}
