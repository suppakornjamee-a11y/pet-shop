"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth-helpers";
import { buildPromptPayPayload } from "@/lib/promptpay";
import { sendLinePush, buildLiffDeepLink } from "@/lib/line";
import { formatBaht } from "@/lib/format";
import { getOrderKind, isOrderFullyPaid, canCheckoutOrder, canStartOrder } from "@/lib/order-kind";
import { buildOrderPlan, createOrderSchema, persistOrder, parseFleaTickDate } from "@/lib/order-plan";
import type { Role } from "@/generated/prisma/enums";
import type { ActionResult } from "./customers";

const EDIT_LOCK_MS = 2 * 24 * 60 * 60 * 1000; // 2 วัน

/** ออเดอร์ที่สร้างมาเกิน 2 วันแล้ว แก้ไข/เพิ่มรายการไม่ได้อีก ยกเว้น ADMIN */
function assertOrderEditable(
  order: { createdAt: Date },
  user: { role: Role }
): { ok: true } | { ok: false; error: string } {
  const isOld = Date.now() - order.createdAt.getTime() > EDIT_LOCK_MS;
  if (isOld && user.role !== "ADMIN") {
    return { ok: false, error: "ออเดอร์นี้สร้างมาเกิน 2 วันแล้ว แก้ไขได้เฉพาะผู้จัดการเท่านั้น" };
  }
  return { ok: true };
}

/**
 * ประกอบข้อความ "ใบเสร็จ" แบบไม่เป็นทางการ (ไม่มีเลขที่ใบกำกับภาษี/Tax ID — แค่สรุปรายการ+ยอดให้ลูกค้าดูย้อนหลังได้)
 * ส่งเป็นข้อความ LINE ธรรมดา ไม่ใช่รูปภาพ เพื่อไม่ต้องพึ่งระบบเรนเดอร์/โฮสต์รูปเพิ่ม
 */
function buildPaymentReceiptText(params: {
  orderCode: string;
  petName: string | null;
  items: { name: string; quantity: number; subtotal: number }[];
  extraCharges: { description: string; amount: number }[];
  holidaySurcharge: number;
  holidayLabel: string | null;
  total: number;
  paidLabel: string;
  paidAmount: number;
  remainingAmount: number;
}): string {
  const lines = [`🧾 สรุปรายการชำระเงิน`, `เลขที่การจอง ${params.orderCode}`];
  if (params.petName) lines.push(`น้อง ${params.petName}`);
  lines.push("");
  for (const it of params.items) {
    lines.push(`${it.name} x${it.quantity}  ${formatBaht(it.subtotal)}`);
  }
  for (const c of params.extraCharges) {
    lines.push(`${c.description} (ค่าใช้จ่ายเพิ่มเติม)  ${formatBaht(c.amount)}`);
  }
  if (params.holidaySurcharge > 0) {
    lines.push(
      `ค่าธรรมเนียมวันหยุด${params.holidayLabel ? ` (${params.holidayLabel})` : ""}  +${formatBaht(params.holidaySurcharge)}`
    );
  }
  lines.push(
    "",
    `ยอดรวมทั้งสิ้น: ${formatBaht(params.total)}`,
    `${params.paidLabel}: ${formatBaht(params.paidAmount)}`,
    params.remainingAmount > 0
      ? `คงเหลือ: ${formatBaht(params.remainingAmount)}`
      : `สถานะ: ชำระครบแล้ว ✅`,
    "",
    `ขอบคุณที่ใช้บริการค่ะ`
  );
  return lines.join("\n");
}

/** ส่งแจ้งเตือน LINE หาลูกค้า (เงียบๆ ไม่ throw ถ้าไม่ได้ผูกบัญชีหรือส่งไม่สำเร็จ) */
async function notifyCustomerLine(orderId: string, text: string) {
  const order = await prisma.order.findUnique({
    where: { id: orderId },
    select: { customer: { select: { lineUserId: true } } },
  });
  const lineUserId = order?.customer.lineUserId;
  if (!lineUserId) return;
  try {
    await sendLinePush(lineUserId, text);
  } catch (e) {
    // ไม่ให้ error การแจ้งเตือนไปกระทบ flow หลัก (ยืนยันชำระเงิน/อัปเดตสถานะ) แต่ยัง log ไว้ดูสาเหตุได้
    console.error("[LINE] push notification failed:", e);
  }
}

const PAYMENT_TTL_MS = 15 * 60 * 1000; // 15 นาที

export async function createOrder(input: unknown): Promise<ActionResult> {
  const user = await requireUser();
  const parsed = createOrderSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message };
  const data = parsed.data;

  const plan = await buildOrderPlan(data);
  if (!plan.ok) return plan;

  const result = await persistOrder(plan, data, { createdById: user.id, createdVia: "STAFF" });
  if (!result.ok) return result;

  await createInitialPayments(result.id, result.total, plan.depositAmount);

  revalidatePath("/orders/bath");
  revalidatePath("/orders/other");
  revalidatePath("/boarding");
  return { ok: true, id: result.id, message: "สร้างออเดอร์เรียบร้อย" };
}

export async function updateOrder(orderId: string, input: unknown): Promise<ActionResult> {
  const user = await requireUser();
  const parsed = createOrderSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message };
  const data = parsed.data;

  const existing = await prisma.order.findUnique({ where: { id: orderId } });
  if (!existing) return { ok: false, error: "ไม่พบออเดอร์" };
  if (existing.status !== "PENDING_PAYMENT") {
    return { ok: false, error: "แก้ไขได้เฉพาะออเดอร์ที่ยังรอชำระเงินเท่านั้น" };
  }
  const editable = assertOrderEditable(existing, user);
  if (!editable.ok) return editable;

  const plan = await buildOrderPlan(data, orderId);
  if (!plan.ok) return plan;

  const total = plan.subtotal + plan.holidaySurcharge;
  const lastFleaTickAt = parseFleaTickDate(data.lastFleaTickDate);

  await prisma.$transaction(async (tx) => {
    await tx.orderItem.deleteMany({ where: { orderId } });
    // สถานะยังเป็น PENDING_PAYMENT แน่นอน (เช็คไว้ข้างบน) จึงยังไม่มี payment ที่ VERIFIED
    await tx.payment.deleteMany({ where: { orderId, status: { not: "VERIFIED" } } });
    await tx.order.update({
      where: { id: orderId },
      data: {
        petId: data.petId || null,
        roomId: plan.room?.id ?? null,
        nights: plan.nights,
        appointmentAt: plan.appointmentAt,
        queueType: plan.appointmentAt ? data.queueType : null,
        checkInAt: plan.checkInAt,
        checkOutAt: plan.checkOutAt,
        nannyType: data.nannyType,
        cctvRequested: data.cctvRequested,
        depositAmount: plan.depositAmount,
        holidaySurcharge: plan.holidaySurcharge,
        holidayLabel: plan.holidayLabel,
        vaccineComplete: data.vaccineComplete,
        lastFleaTickAt,
        fleaTickMedicine: data.fleaTickMedicine || null,
        subtotal: plan.subtotal,
        total,
        note: data.note || null,
        updatedById: user.id,
        items: { create: plan.items },
      },
    });
  });

  if (data.petId) {
    await prisma.pet.update({
      where: { id: data.petId },
      data: {
        vaccineComplete: data.vaccineComplete,
        lastFleaTickAt,
        fleaTickMedicine: data.fleaTickMedicine || null,
      },
    });
  }

  await createInitialPayments(orderId, total, plan.depositAmount);

  revalidatePath(`/orders/${orderId}`);
  revalidatePath("/orders/bath");
  revalidatePath("/orders/other");
  revalidatePath("/boarding");
  return { ok: true, id: orderId, message: "แก้ไขออเดอร์เรียบร้อย สร้าง QR ใหม่แล้ว (15 นาที)" };
}

async function defaultPromptPayAccount() {
  return (
    (await prisma.bankAccount.findFirst({
      where: { type: "PROMPTPAY", active: true, isDefault: true },
    })) ?? (await prisma.bankAccount.findFirst({ where: { type: "PROMPTPAY", active: true } }))
  );
}

async function insertPayment(
  orderId: string,
  amount: number,
  purpose: "DEPOSIT" | "BALANCE"
) {
  const account = await defaultPromptPayAccount();
  const qrPayload =
    account?.promptpayId ? buildPromptPayPayload(account.promptpayId, amount) : null;
  const expiresAt = new Date(Date.now() + PAYMENT_TTL_MS);

  return prisma.payment.create({
    data: {
      orderId,
      purpose,
      amount,
      method: "PROMPTPAY",
      status: "PENDING",
      bankAccountId: account?.id ?? null,
      qrPayload,
      expiresAt,
    },
  });
}

/** สร้าง payment แรกของออเดอร์ — ถ้ามีมัดจำ สร้างแค่ยอดมัดจำก่อน ถ้าไม่มีมัดจำ สร้างเต็มยอด */
export async function createInitialPayments(orderId: string, total: number, depositAmount: number) {
  if (depositAmount > 0) {
    await insertPayment(orderId, depositAmount, "DEPOSIT");
  } else {
    await insertPayment(orderId, total, "BALANCE");
  }
}

/** เก็บส่วนที่เหลือ (หลังมัดจำยืนยันแล้ว) */
export async function createBalancePayment(orderId: string): Promise<ActionResult> {
  await requireUser();
  const order = await prisma.order.findUnique({
    where: { id: orderId },
    include: { payments: true, extraCharges: true },
  });
  if (!order) return { ok: false, error: "ไม่พบออเดอร์" };
  // เก็บยอดคงเหลือได้ตั้งแต่เริ่มดำเนินการแล้ว (ให้พนักงานขอ QR ตอนลูกค้ามาจ่ายหน้างานได้ ไม่ต้องรอเช็คเอ้าท์ก่อน)
  // — ออเดอร์อาบน้ำต้องจ่ายครบก่อนถึงจะเช็คเอ้าท์ได้อยู่แล้ว ถ้าบังคับ COMPLETED ก่อนถึงจะสร้าง QR ได้จะกลายเป็นชนกันเอง
  if (order.status === "PENDING_PAYMENT") {
    return { ok: false, error: "ออเดอร์นี้ยังไม่ได้ชำระมัดจำ" };
  }
  if (order.status === "CANCELLED") {
    return { ok: false, error: "ออเดอร์นี้ถูกยกเลิกแล้ว" };
  }
  if (order.status !== "COMPLETED" && order.status !== "IN_PROGRESS") {
    return { ok: false, error: "ออเดอร์ต้องเริ่มดำเนินการก่อน จึงจะเก็บยอดคงเหลือได้" };
  }
  const hasOpenPayment = order.payments.some((p) => p.status !== "VERIFIED" && p.status !== "REJECTED");
  if (hasOpenPayment) {
    return { ok: false, error: "มีรายการชำระเงินที่ยังไม่เสร็จสิ้นอยู่แล้ว" };
  }
  const verifiedSum = order.payments
    .filter((p) => p.status === "VERIFIED")
    .reduce((sum, p) => sum + p.amount, 0);
  // รวมค่าเสียหายเพิ่มเติมเข้ากับยอดคงเหลือที่ต้องเก็บตอนจ่ายส่วนที่เหลือ
  const extraChargesSum = order.extraCharges.reduce((sum, c) => sum + c.amount, 0);
  const remaining = order.total + extraChargesSum - verifiedSum;
  if (remaining <= 0) {
    return { ok: false, error: "ไม่มียอดคงเหลือให้เก็บแล้ว" };
  }

  await insertPayment(orderId, remaining, "BALANCE");
  revalidatePath(`/orders/${orderId}`);

  // ส่งลิงก์จ่ายเงินให้ลูกค้าทาง LINE อัตโนมัติทุกครั้ง — กันกรณีลูกค้าไม่ได้อยู่หน้าร้าน/ปิดแอปไปแล้ว
  // ยังต้องมีทางกลับมาจ่ายเองได้โดยไม่ต้องรอพนักงานหาไลน์คุยทีละคน
  const link = buildLiffDeepLink(`/pay/${orderId}`);
  if (link) {
    void notifyCustomerLine(
      orderId,
      `แจ้งยอดคงเหลือที่ต้องชำระ ✅\nออเดอร์ ${order.code}\nยอดคงเหลือ ${formatBaht(remaining)}\nกดลิงก์นี้เพื่อชำระเงิน:\n${link}`
    );
  }

  return { ok: true, message: "สร้าง QR ยอดคงเหลือเรียบร้อย" };
}

export async function regeneratePayment(paymentId: string): Promise<ActionResult> {
  await requireUser();
  const payment = await prisma.payment.findUnique({
    where: { id: paymentId },
    include: { order: true },
  });
  if (!payment) return { ok: false, error: "ไม่พบรายการชำระเงิน" };
  if (payment.status === "VERIFIED") {
    return { ok: false, error: "รายการนี้ยืนยันแล้ว ไม่ต้องสร้าง QR ใหม่" };
  }
  // สร้าง QR ใหม่ได้ตราบใดที่ออเดอร์ไม่ได้ถูกยกเลิก (แม้งานจะเสร็จ/เช็คเอาท์ไปแล้ว ก็ยังเก็บยอดคงเหลือย้อนหลังได้)
  if (payment.order.status === "CANCELLED") {
    return { ok: false, error: "ออเดอร์นี้ถูกยกเลิกแล้ว" };
  }
  const account = await defaultPromptPayAccount();
  const qrPayload =
    account?.promptpayId ? buildPromptPayPayload(account.promptpayId, payment.amount) : null;
  const expiresAt = new Date(Date.now() + PAYMENT_TTL_MS);
  await prisma.payment.update({
    where: { id: paymentId },
    data: {
      status: "PENDING",
      bankAccountId: account?.id ?? null,
      qrPayload,
      expiresAt,
      slipUrl: null,
      submittedAt: null,
      rejectReason: null,
    },
  });
  revalidatePath(`/orders/${payment.orderId}`);
  return { ok: true, message: "สร้าง QR ใหม่เรียบร้อย (มีเวลา 15 นาที)" };
}

export async function verifyPayment(paymentId: string): Promise<ActionResult> {
  const user = await requireUser();

  const lookup = await prisma.payment.findUnique({ where: { id: paymentId }, select: { orderId: true } });
  if (!lookup) return { ok: false, error: "ไม่พบรายการชำระเงิน" };
  const orderId = lookup.orderId;

  const result = await prisma.$transaction(async (tx) => {
    const payment = await tx.payment.findUnique({
      where: { id: paymentId },
      include: { order: { include: { items: true, payments: true, extraCharges: true, pet: true } } },
    });
    if (!payment) return { ok: false as const, error: "ไม่พบรายการชำระเงิน" };
    if (payment.status === "VERIFIED") {
      return { ok: false as const, error: "ชำระเงินนี้ยืนยันไปแล้ว" };
    }

    await tx.payment.update({
      where: { id: paymentId },
      data: { status: "VERIFIED", verifiedAt: new Date(), verifiedById: user.id, rejectReason: null },
    });

    const order = payment.order;
    // ยอดที่ยืนยันแล้ว "ก่อน" รายการนี้ (order.payments เป็นข้อมูลก่อน update ด้านบน)
    const previouslyVerifiedSum = order.payments
      .filter((p) => p.status === "VERIFIED")
      .reduce((sum, p) => sum + p.amount, 0);
    const verifiedSum = previouslyVerifiedSum + payment.amount;
    const wasFullyPaidBefore = previouslyVerifiedSum >= order.total;
    const nowFullyPaid = verifiedSum >= order.total;
    // ชำระครบยอด "ครั้งแรก" ไหม — เช็คจากยอดเงินจริง ไม่ใช่สถานะงาน เพราะงานอาจเสร็จ/เช็คเอาท์ไปแล้วก่อนจะมาจ่ายส่วนที่เหลือย้อนหลังได้
    const justFullyPaid = !wasFullyPaidBefore && nowFullyPaid;
    // สถานะงานที่เดินหน้าไปไกลกว่า "ชำระแล้ว" แล้ว ไม่ควรถอยสถานะกลับ
    const statusAlreadyAdvanced = (["PAID", "IN_PROGRESS", "COMPLETED"] as string[]).includes(order.status);
    // มัดจำสำเร็จ "ครั้งแรก" ไหม — เช็คจากสถานะออเดอร์ก่อนหน้า กันแจ้งซ้ำถ้ายืนยันซ้ำ/มีรายการมัดจำมากกว่า 1 ครั้ง
    const justDepositPaid =
      !nowFullyPaid && !statusAlreadyAdvanced && payment.purpose === "DEPOSIT" && order.status !== "DEPOSIT_PAID";

    if (nowFullyPaid && !statusAlreadyAdvanced) {
      await tx.order.update({ where: { id: order.id }, data: { status: "PAID", updatedById: user.id } });
    } else if (!nowFullyPaid && !statusAlreadyAdvanced && payment.purpose === "DEPOSIT") {
      await tx.order.update({ where: { id: order.id }, data: { status: "DEPOSIT_PAID", updatedById: user.id } });
    }

    if (justFullyPaid) {
      // ตัดสต็อกสินค้า (เฉพาะตอนชำระครบยอดครั้งแรกเท่านั้น ไม่ว่าสถานะงานจะไปถึงไหนแล้วก็ตาม)
      for (const it of order.items) {
        if (it.itemType === "PRODUCT" && it.refId) {
          await tx.product.update({
            where: { id: it.refId },
            data: { stockQty: { decrement: it.quantity } },
          });
          await tx.stockMovement.create({
            data: {
              productId: it.refId,
              type: "OUT",
              quantity: it.quantity,
              reason: `ขายในออเดอร์ ${order.code}`,
              createdById: user.id,
            },
          });
        }
      }
    }

    return {
      ok: true as const,
      justFullyPaid,
      justDepositPaid,
      orderCode: order.code,
      petName: order.pet?.name ?? null,
      orderTotal: order.total,
      depositAmount: payment.amount,
      verifiedSum,
      remainingAmount: Math.max(0, order.total - verifiedSum),
      items: order.items.map((it) => ({ name: it.name, quantity: it.quantity, subtotal: it.subtotal })),
      extraCharges: order.extraCharges.map((c) => ({ description: c.description, amount: c.amount })),
      holidaySurcharge: order.holidaySurcharge,
      holidayLabel: order.holidayLabel,
    };
  });

  revalidatePath(`/orders/${orderId}`);
  if (!result.ok) return result;
  revalidatePath("/orders/bath");
  revalidatePath("/orders/other");
  revalidatePath("/boarding");

  if (result.justFullyPaid) {
    void notifyCustomerLine(
      orderId,
      buildPaymentReceiptText({
        orderCode: result.orderCode,
        petName: result.petName,
        items: result.items,
        extraCharges: result.extraCharges,
        holidaySurcharge: result.holidaySurcharge,
        holidayLabel: result.holidayLabel,
        total: result.orderTotal,
        paidLabel: "ชำระแล้ว",
        paidAmount: result.verifiedSum,
        remainingAmount: result.remainingAmount,
      })
    );
  } else if (result.justDepositPaid) {
    void notifyCustomerLine(
      orderId,
      buildPaymentReceiptText({
        orderCode: result.orderCode,
        petName: result.petName,
        items: result.items,
        extraCharges: result.extraCharges,
        holidaySurcharge: result.holidaySurcharge,
        holidayLabel: result.holidayLabel,
        total: result.orderTotal,
        paidLabel: "ชำระมัดจำ",
        paidAmount: result.depositAmount,
        remainingAmount: result.remainingAmount,
      })
    );
  }
  return { ok: true, message: "ยืนยันการชำระเงินเรียบร้อย" };
}

export async function rejectPayment(paymentId: string, reason: string): Promise<ActionResult> {
  await requireUser();
  const payment = await prisma.payment.update({
    where: { id: paymentId },
    data: { status: "REJECTED", rejectReason: reason || "ยอดไม่ตรง / สลิปไม่ถูกต้อง" },
  });
  revalidatePath(`/orders/${payment.orderId}`);
  return { ok: true, message: "ปฏิเสธการชำระเงินแล้ว แจ้งลูกค้าให้ส่งสลิปใหม่" };
}

const statusSchema = z.enum([
  "PENDING_PAYMENT",
  "DEPOSIT_PAID",
  "PAID",
  "IN_PROGRESS",
  "COMPLETED",
  "CANCELLED",
]);

export type UpdateOrderStatusResult = ActionResult & { cctvReminder?: boolean };

export async function updateOrderStatus(orderId: string, status: string): Promise<UpdateOrderStatusResult> {
  const user = await requireUser();
  const parsed = statusSchema.safeParse(status);
  if (!parsed.success) return { ok: false, error: "สถานะไม่ถูกต้อง" };
  const target = parsed.data;

  const order = await prisma.order.findUnique({
    where: { id: orderId },
    include: { payments: true, extraCharges: true },
  });
  if (!order) return { ok: false, error: "ไม่พบออเดอร์" };

  const orderKind = getOrderKind(order);
  const fullyPaid = isOrderFullyPaid(order);

  if (target === "IN_PROGRESS" && !canStartOrder(orderKind, user.role)) {
    return {
      ok: false,
      error:
        orderKind === "BOARDING"
          ? "จัดการสถานะออเดอร์ฝากเลี้ยงได้เฉพาะผู้จัดการเท่านั้น"
          : "เริ่มดำเนินการงานอาบน้ำได้เฉพาะช่างอาบน้ำหรือผู้จัดการเท่านั้น",
    };
  }
  if (target === "COMPLETED" && !canCheckoutOrder(orderKind, user.role)) {
    return {
      ok: false,
      error:
        orderKind === "BOARDING"
          ? "จัดการสถานะออเดอร์ฝากเลี้ยงได้เฉพาะผู้จัดการเท่านั้น"
          : "เช็คเอ้าท์ได้เฉพาะพนักงานหรือผู้จัดการเท่านั้น",
    };
  }
  if (orderKind === "BOARDING" && target === "IN_PROGRESS" && !fullyPaid) {
    return { ok: false, error: "ออเดอร์ฝากเลี้ยงต้องชำระเงินเต็มจำนวนก่อนเริ่มดำเนินการ" };
  }
  if (orderKind === "BATH" && target === "COMPLETED" && !fullyPaid) {
    return { ok: false, error: "ต้องชำระเงินให้ครบก่อนเช็คเอ้าท์" };
  }
  // orderKind === "OTHER": ไม่จำกัดเพิ่ม เหมือนเดิม

  const alreadyInProgress = order.status === "IN_PROGRESS";

  const updated = await prisma.order.update({
    where: { id: orderId },
    data: { status: target, updatedById: user.id },
  });

  let joinedOnly = false;
  if (target === "IN_PROGRESS" && orderKind === "BATH") {
    const actor = user.role === "ADMIN" ? "ผู้จัดการ" : "ช่าง";
    await prisma.orderActivityLog.create({
      data: { orderId, action: `${actor} ${user.name} เริ่มดำเนินการ`, createdById: user.id },
    });
    // ออเดอร์นี้ IN_PROGRESS อยู่แล้ว (ช่างคนอื่นกดไว้ก่อน) — แค่บันทึกว่าเข้าร่วมงานเพิ่ม ไม่ใช่การเริ่มงานครั้งแรก
    joinedOnly = alreadyInProgress;
  }

  revalidatePath(`/orders/${orderId}`);
  revalidatePath("/orders/bath");
  revalidatePath("/orders/other");
  revalidatePath("/boarding");

  if (target === "COMPLETED") {
    void notifyCustomerLine(
      orderId,
      `บริการเสร็จเรียบร้อยแล้วค่ะ 🎉\nออเดอร์ ${updated.code}\nสามารถมารับได้เลยค่ะ 🐾`
    );
  }

  const cctvReminder = target === "COMPLETED" && orderKind === "BOARDING" && order.cctvRequested;
  const message = joinedOnly ? `บันทึกแล้ว: ${user.name} เข้าร่วมงานนี้ด้วย` : "อัปเดตสถานะเรียบร้อย";

  return { ok: true, message, ...(cctvReminder ? { cctvReminder: true } : {}) };
}

/**
 * ช่าง (หรือแอดมิน) กดว่าทำส่วนของตัวเองในงานอาบน้ำนี้เสร็จแล้ว — แค่บันทึก log ไม่เปลี่ยนสถานะออเดอร์
 * (สถานะจะเป็น COMPLETED จริงก็ต่อเมื่อพนักงาน/แอดมินกดเช็คเอ้าท์ตอนลูกค้าชำระเงินครบแล้วเท่านั้น)
 */
export async function markGroomerFinished(orderId: string): Promise<ActionResult> {
  const user = await requireUser();
  if (user.role !== "GROOMER" && user.role !== "ADMIN") {
    return { ok: false, error: "เฉพาะช่างอาบน้ำหรือผู้จัดการเท่านั้น" };
  }
  const order = await prisma.order.findUnique({ where: { id: orderId } });
  if (!order) return { ok: false, error: "ไม่พบออเดอร์" };
  if (getOrderKind(order) !== "BATH") return { ok: false, error: "ใช้ได้เฉพาะออเดอร์อาบน้ำ" };
  if (order.status !== "IN_PROGRESS") return { ok: false, error: "ออเดอร์นี้ยังไม่ได้เริ่มดำเนินการ" };

  const actor = user.role === "ADMIN" ? "ผู้จัดการ" : "ช่าง";
  await prisma.orderActivityLog.create({
    data: { orderId, action: `${actor} ${user.name} ทำรายการเสร็จสิ้น`, createdById: user.id },
  });

  revalidatePath(`/orders/${orderId}`);
  return { ok: true, message: `บันทึกแล้ว: ${user.name} ทำรายการเสร็จสิ้น` };
}

/**
 * ถ้ามี QR ยอดคงเหลือที่ยัง PENDING อยู่ ให้คำนวณยอดใหม่จากยอดออเดอร์ + ค่าเสียหายเพิ่มเติมล่าสุด
 * แล้วอัปเดต QR ให้ตรง — ป้องกันไม่ให้ QR ค้างยอดเก่าเมื่อมีการแก้ไขรายการ/ค่าเสียหายหลังสร้าง QR ไปแล้ว
 */
async function syncPendingBalancePayment(orderId: string) {
  const order = await prisma.order.findUnique({
    where: { id: orderId },
    include: { payments: true, extraCharges: true },
  });
  if (!order) return;
  const pending = order.payments.find((p) => p.purpose === "BALANCE" && p.status === "PENDING");
  if (!pending) return;

  const verifiedSum = order.payments
    .filter((p) => p.status === "VERIFIED")
    .reduce((sum, p) => sum + p.amount, 0);
  const extraChargesSum = order.extraCharges.reduce((sum, c) => sum + c.amount, 0);
  const correctAmount = order.total + extraChargesSum - verifiedSum;

  if (correctAmount === pending.amount) return;
  if (correctAmount <= 0) {
    // แก้ไขรายการจนไม่มียอดคงเหลือต้องเก็บแล้ว — ลบ QR ที่ยังไม่มีใครจ่ายทิ้งไปเลย (ไม่ใช้สถานะ REJECTED
    // เพราะนั่นสงวนไว้สำหรับกรณีแอดมินปฏิเสธสลิปที่ลูกค้าส่งมาจริง ซึ่งต้องกด "สร้าง QR ใหม่" เพื่อลองอีกครั้งได้)
    await prisma.payment.delete({ where: { id: pending.id } });
    return;
  }

  const account = await defaultPromptPayAccount();
  const qrPayload = account?.promptpayId ? buildPromptPayPayload(account.promptpayId, correctAmount) : null;
  await prisma.payment.update({
    where: { id: pending.id },
    data: {
      amount: correctAmount,
      qrPayload,
      bankAccountId: account?.id ?? pending.bankAccountId,
      expiresAt: new Date(Date.now() + PAYMENT_TTL_MS),
    },
  });
}

/**
 * เช็คว่าออเดอร์นี้ยังมียอดค้างชำระอยู่ไหม — ชำระครบแล้วแก้ไขรายการ/ค่าเสียหายเพิ่มเติมไม่ได้อีก
 * เพราะยอดที่จ่ายไปแล้วจะไม่ถูกเรียกเก็บเพิ่มอัตโนมัติ (ไม่มี pending QR ให้ sync ต่อ)
 */
async function assertOrderNotFullyPaid(orderId: string): Promise<{ ok: true } | { ok: false; error: string }> {
  const order = await prisma.order.findUnique({
    where: { id: orderId },
    include: { payments: true, extraCharges: true },
  });
  if (!order) return { ok: false, error: "ไม่พบออเดอร์" };
  const verifiedSum = order.payments
    .filter((p) => p.status === "VERIFIED")
    .reduce((sum, p) => sum + p.amount, 0);
  const amountOwed = order.total + order.extraCharges.reduce((sum, c) => sum + c.amount, 0);
  if (amountOwed > 0 && verifiedSum >= amountOwed) {
    return { ok: false, error: "ออเดอร์นี้ชำระเงินครบถ้วนแล้ว แก้ไขรายการไม่ได้อีก" };
  }
  return { ok: true };
}

/**
 * ค่าเสียหายเพิ่มเติม (เช่น อาบน้ำแล้วโดนกัดต้องพาไปทำแผล) — เห็นเฉพาะฝั่งหลังบ้าน
 * บันทึกแยกไว้เป็นข้อมูลอ้างอิง ไม่รวมเข้ายอดออเดอร์/QR หลัก แต่จะรวมเข้ายอดคงเหลือตอนเก็บเงินส่วนที่เหลือ
 */
const extraChargeSchema = z.object({
  amount: z.coerce.number().int().min(1, "กรุณากรอกยอดเงิน"),
  description: z.string().min(1, "กรุณากรอกรายละเอียด"),
});

export async function addExtraCharge(orderId: string, input: unknown): Promise<ActionResult> {
  const user = await requireUser();
  const parsed = extraChargeSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message };
  const notFullyPaid = await assertOrderNotFullyPaid(orderId);
  if (!notFullyPaid.ok) return notFullyPaid;

  await prisma.$transaction([
    prisma.orderExtraCharge.create({
      data: { orderId, ...parsed.data, createdById: user.id },
    }),
    prisma.orderActivityLog.create({
      data: {
        orderId,
        action: `เพิ่มค่าเสียหายเพิ่มเติม: ${parsed.data.description} (${formatBaht(parsed.data.amount)})`,
        createdById: user.id,
      },
    }),
  ]);
  await syncPendingBalancePayment(orderId);
  revalidatePath(`/orders/${orderId}`);
  return { ok: true, message: "บันทึกค่าเสียหายเพิ่มเติมเรียบร้อย" };
}

export async function updateExtraCharge(id: string, input: unknown): Promise<ActionResult> {
  const user = await requireUser();
  const parsed = extraChargeSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message };

  const existing = await prisma.orderExtraCharge.findUnique({ where: { id } });
  if (!existing) return { ok: false, error: "ไม่พบรายการนี้" };
  const notFullyPaid = await assertOrderNotFullyPaid(existing.orderId);
  if (!notFullyPaid.ok) return notFullyPaid;

  const [charge] = await prisma.$transaction([
    prisma.orderExtraCharge.update({ where: { id }, data: parsed.data }),
    prisma.orderActivityLog.create({
      data: {
        orderId: existing.orderId,
        action: `แก้ไขค่าเสียหายเพิ่มเติม: ${parsed.data.description} (${formatBaht(parsed.data.amount)})`,
        createdById: user.id,
      },
    }),
  ]);
  await syncPendingBalancePayment(charge.orderId);
  revalidatePath(`/orders/${charge.orderId}`);
  return { ok: true, message: "แก้ไขค่าเสียหายเพิ่มเติมเรียบร้อย" };
}

export async function deleteExtraCharge(id: string): Promise<ActionResult> {
  const user = await requireUser();
  const existing = await prisma.orderExtraCharge.findUnique({ where: { id } });
  if (!existing) return { ok: false, error: "ไม่พบรายการนี้" };
  const notFullyPaid = await assertOrderNotFullyPaid(existing.orderId);
  if (!notFullyPaid.ok) return notFullyPaid;

  const [charge] = await prisma.$transaction([
    prisma.orderExtraCharge.delete({ where: { id } }),
    prisma.orderActivityLog.create({
      data: {
        orderId: existing.orderId,
        action: `ลบค่าเสียหายเพิ่มเติม: ${existing.description} (${formatBaht(existing.amount)})`,
        createdById: user.id,
      },
    }),
  ]);
  await syncPendingBalancePayment(charge.orderId);
  revalidatePath(`/orders/${charge.orderId}`);
  return { ok: true, message: "ลบรายการเรียบร้อย" };
}

/**
 * เพิ่มบริการเข้าออเดอร์ที่มีอยู่แล้วระหว่างทำงาน (เช่น ช่างเจอว่าต้องตัดขนพันกันเพิ่ม)
 * ไม่ยุ่งกับ payment ที่มีอยู่แล้ว — ยอดที่เพิ่มจะไปรวมอยู่ในยอดคงเหลือตอนเก็บเงินส่วนที่เหลือ
 * บันทึก log ไว้ทุกครั้งว่าใครเพิ่มอะไร เมื่อไหร่
 */
export async function addOrderItem(orderId: string, serviceId: string): Promise<ActionResult> {
  const user = await requireUser();
  const order = await prisma.order.findUnique({ where: { id: orderId } });
  if (!order) return { ok: false, error: "ไม่พบออเดอร์" };
  if (order.status === "CANCELLED") return { ok: false, error: "ออเดอร์นี้ถูกยกเลิกแล้ว" };
  const editable = assertOrderEditable(order, user);
  if (!editable.ok) return editable;

  const service = await prisma.service.findUnique({ where: { id: serviceId } });
  if (!service || !service.active) return { ok: false, error: "ไม่พบบริการนี้" };

  await prisma.$transaction([
    prisma.orderItem.create({
      data: {
        orderId,
        itemType: "SERVICE",
        refId: service.id,
        name: service.name,
        unitPrice: service.price,
        quantity: 1,
        subtotal: service.price,
      },
    }),
    prisma.order.update({
      where: { id: orderId },
      data: {
        subtotal: { increment: service.price },
        total: { increment: service.price },
        updatedById: user.id,
      },
    }),
    prisma.orderActivityLog.create({
      data: {
        orderId,
        action: `เพิ่มบริการ: ${service.name} (${formatBaht(service.price)})`,
        createdById: user.id,
      },
    }),
  ]);

  await syncPendingBalancePayment(orderId);
  revalidatePath(`/orders/${orderId}`);
  return { ok: true, message: "เพิ่มบริการเรียบร้อย" };
}

/** ลบรายการออกจากออเดอร์ — ต้องเหลืออย่างน้อย 1 รายการเสมอ */
export async function removeOrderItem(itemId: string): Promise<ActionResult> {
  const user = await requireUser();
  const item = await prisma.orderItem.findUnique({ where: { id: itemId }, include: { order: true } });
  if (!item) return { ok: false, error: "ไม่พบรายการนี้" };
  if (item.order.status === "CANCELLED") return { ok: false, error: "ออเดอร์นี้ถูกยกเลิกแล้ว" };
  const editable = assertOrderEditable(item.order, user);
  if (!editable.ok) return editable;

  const itemCount = await prisma.orderItem.count({ where: { orderId: item.orderId } });
  if (itemCount <= 1) {
    return { ok: false, error: "ออเดอร์ต้องมีอย่างน้อย 1 รายการ ลบรายการสุดท้ายไม่ได้" };
  }

  await prisma.$transaction([
    prisma.orderItem.delete({ where: { id: itemId } }),
    prisma.order.update({
      where: { id: item.orderId },
      data: {
        subtotal: { decrement: item.subtotal },
        total: { decrement: item.subtotal },
        updatedById: user.id,
      },
    }),
    prisma.orderActivityLog.create({
      data: {
        orderId: item.orderId,
        action: `ลบรายการ: ${item.name} (${formatBaht(item.subtotal)})`,
        createdById: user.id,
      },
    }),
  ]);

  await syncPendingBalancePayment(item.orderId);
  revalidatePath(`/orders/${item.orderId}`);
  return { ok: true, message: "ลบรายการเรียบร้อย" };
}
