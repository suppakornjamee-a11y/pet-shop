"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireStaffUser } from "@/lib/auth-helpers";
import type { ActionResult } from "./customers";

/**
 * ยกเลิกคำขอจองจาก LINE ทั้งคำขอ — ส่วนการอนุมัติคิว / แจ้งคิวไม่ว่าง ทำทีละรายการที่หน้าออเดอร์
 * (approveOrderQueue / rejectOrderQueue ใน actions/orders.ts)
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
