"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth-helpers";
import { generateOrderCode } from "@/lib/order-code";
import { buildPromptPayPayload } from "@/lib/promptpay";
import type { ActionResult } from "./customers";

const PAYMENT_TTL_MS = 15 * 60 * 1000; // 15 นาที

const createOrderSchema = z.object({
  customerId: z.string().min(1, "กรุณาเลือกลูกค้า"),
  petId: z.string().optional().nullable(),
  roomId: z.string().optional().nullable(),
  nights: z.coerce.number().int().min(0).default(0),
  note: z.string().optional(),
  serviceIds: z.array(z.string()).default([]),
  productLines: z
    .array(z.object({ productId: z.string(), quantity: z.coerce.number().int().min(1) }))
    .default([]),
});

export async function createOrder(input: unknown): Promise<ActionResult> {
  const user = await requireUser();
  const parsed = createOrderSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message };
  const data = parsed.data;

  const hasSomething =
    data.serviceIds.length > 0 || data.productLines.length > 0 || (data.roomId && data.nights > 0);
  if (!hasSomething) {
    return { ok: false, error: "กรุณาเพิ่มบริการ ห้องพัก หรือสินค้าอย่างน้อย 1 รายการ" };
  }

  // ดึงราคาจริงจากฐานข้อมูล (ไม่เชื่อราคาจาก client)
  const [services, room, products] = await Promise.all([
    data.serviceIds.length
      ? prisma.service.findMany({ where: { id: { in: data.serviceIds } } })
      : Promise.resolve([]),
    data.roomId ? prisma.room.findUnique({ where: { id: data.roomId } }) : Promise.resolve(null),
    data.productLines.length
      ? prisma.product.findMany({ where: { id: { in: data.productLines.map((p) => p.productId) } } })
      : Promise.resolve([]),
  ]);

  const items: {
    itemType: "SERVICE" | "ROOM" | "PRODUCT";
    refId: string;
    name: string;
    unitPrice: number;
    quantity: number;
    subtotal: number;
  }[] = [];

  for (const s of services) {
    items.push({
      itemType: "SERVICE",
      refId: s.id,
      name: s.name,
      unitPrice: s.price,
      quantity: 1,
      subtotal: s.price,
    });
  }

  if (room && data.nights > 0) {
    items.push({
      itemType: "ROOM",
      refId: room.id,
      name: `ห้องพัก ${room.name} (${data.nights} คืน)`,
      unitPrice: room.pricePerNight,
      quantity: data.nights,
      subtotal: room.pricePerNight * data.nights,
    });
  }

  for (const line of data.productLines) {
    const p = products.find((x) => x.id === line.productId);
    if (!p) continue;
    items.push({
      itemType: "PRODUCT",
      refId: p.id,
      name: p.name,
      unitPrice: p.price,
      quantity: line.quantity,
      subtotal: p.price * line.quantity,
    });
  }

  const subtotal = items.reduce((sum, it) => sum + it.subtotal, 0);
  const total = subtotal;

  const code = await generateOrderCode();

  const order = await prisma.order.create({
    data: {
      code,
      customerId: data.customerId,
      petId: data.petId || null,
      roomId: room && data.nights > 0 ? room.id : null,
      nights: room && data.nights > 0 ? data.nights : 0,
      subtotal,
      total,
      note: data.note || null,
      createdById: user.id,
      updatedById: user.id,
      status: "PENDING_PAYMENT",
      items: { create: items },
    },
  });

  // สร้าง Payment + QR PromptPay ทันที
  await createPaymentWithQr(order.id, total);

  revalidatePath("/orders");
  return { ok: true, id: order.id, message: "สร้างออเดอร์เรียบร้อย" };
}

/** ดึงราคาจริงจาก DB แล้วประกอบเป็นรายการออเดอร์ (ใช้ร่วมกันทั้งสร้างและแก้ไข) */
async function resolveOrderItems(data: {
  roomId?: string | null;
  nights: number;
  serviceIds: string[];
  productLines: { productId: string; quantity: number }[];
}) {
  const [services, room, products] = await Promise.all([
    data.serviceIds.length
      ? prisma.service.findMany({ where: { id: { in: data.serviceIds } } })
      : Promise.resolve([]),
    data.roomId ? prisma.room.findUnique({ where: { id: data.roomId } }) : Promise.resolve(null),
    data.productLines.length
      ? prisma.product.findMany({ where: { id: { in: data.productLines.map((p) => p.productId) } } })
      : Promise.resolve([]),
  ]);

  const items: {
    itemType: "SERVICE" | "ROOM" | "PRODUCT";
    refId: string;
    name: string;
    unitPrice: number;
    quantity: number;
    subtotal: number;
  }[] = [];

  for (const s of services) {
    items.push({
      itemType: "SERVICE",
      refId: s.id,
      name: s.name,
      unitPrice: s.price,
      quantity: 1,
      subtotal: s.price,
    });
  }

  if (room && data.nights > 0) {
    items.push({
      itemType: "ROOM",
      refId: room.id,
      name: `ห้องพัก ${room.name} (${data.nights} คืน)`,
      unitPrice: room.pricePerNight,
      quantity: data.nights,
      subtotal: room.pricePerNight * data.nights,
    });
  }

  for (const line of data.productLines) {
    const p = products.find((x) => x.id === line.productId);
    if (!p) continue;
    items.push({
      itemType: "PRODUCT",
      refId: p.id,
      name: p.name,
      unitPrice: p.price,
      quantity: line.quantity,
      subtotal: p.price * line.quantity,
    });
  }

  const subtotal = items.reduce((sum, it) => sum + it.subtotal, 0);
  return { items, subtotal, room };
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

  const hasSomething =
    data.serviceIds.length > 0 || data.productLines.length > 0 || (data.roomId && data.nights > 0);
  if (!hasSomething) {
    return { ok: false, error: "กรุณาเพิ่มบริการ ห้องพัก หรือสินค้าอย่างน้อย 1 รายการ" };
  }

  const { items, subtotal, room } = await resolveOrderItems(data);
  const total = subtotal;

  await prisma.$transaction(async (tx) => {
    await tx.orderItem.deleteMany({ where: { orderId } });
    await tx.order.update({
      where: { id: orderId },
      data: {
        petId: data.petId || null,
        roomId: room && data.nights > 0 ? room.id : null,
        nights: room && data.nights > 0 ? data.nights : 0,
        subtotal,
        total,
        note: data.note || null,
        updatedById: user.id,
        items: { create: items },
      },
    });
  });

  // สร้าง QR ใหม่ + รีเซ็ตเวลา 15 นาที ตามยอดใหม่
  await createPaymentWithQr(orderId, total);

  revalidatePath(`/orders/${orderId}`);
  revalidatePath("/orders");
  return { ok: true, id: orderId, message: "แก้ไขออเดอร์เรียบร้อย สร้าง QR ใหม่แล้ว (15 นาที)" };
}

async function createPaymentWithQr(orderId: string, amount: number) {
  const account =
    (await prisma.bankAccount.findFirst({
      where: { type: "PROMPTPAY", active: true, isDefault: true },
    })) ??
    (await prisma.bankAccount.findFirst({ where: { type: "PROMPTPAY", active: true } }));

  const qrPayload =
    account?.promptpayId ? buildPromptPayPayload(account.promptpayId, amount) : null;
  const expiresAt = new Date(Date.now() + PAYMENT_TTL_MS);

  await prisma.payment.upsert({
    where: { orderId },
    create: {
      orderId,
      amount,
      method: "PROMPTPAY",
      status: "PENDING",
      bankAccountId: account?.id ?? null,
      qrPayload,
      expiresAt,
    },
    update: {
      amount,
      status: "PENDING",
      bankAccountId: account?.id ?? null,
      qrPayload,
      expiresAt,
      slipUrl: null,
      submittedAt: null,
      rejectReason: null,
    },
  });
}

export async function regeneratePayment(orderId: string): Promise<ActionResult> {
  await requireUser();
  const order = await prisma.order.findUnique({ where: { id: orderId } });
  if (!order) return { ok: false, error: "ไม่พบออเดอร์" };
  if (order.status !== "PENDING_PAYMENT") {
    return { ok: false, error: "ออเดอร์นี้ไม่ได้อยู่ในสถานะรอชำระเงิน" };
  }
  await createPaymentWithQr(orderId, order.total);
  revalidatePath(`/orders/${orderId}`);
  return { ok: true, message: "สร้าง QR ใหม่เรียบร้อย (มีเวลา 15 นาที)" };
}

export async function markSlipSubmitted(orderId: string, slipUrl?: string): Promise<ActionResult> {
  await requireUser();
  await prisma.payment.update({
    where: { orderId },
    data: { status: "SUBMITTED", submittedAt: new Date(), slipUrl: slipUrl || null },
  });
  revalidatePath(`/orders/${orderId}`);
  return { ok: true, message: "บันทึกการอัปโหลดสลิปแล้ว รอตรวจสอบ" };
}

export async function verifyPayment(orderId: string): Promise<ActionResult> {
  const user = await requireUser();

  const result = await prisma.$transaction(async (tx) => {
    const order = await tx.order.findUnique({
      where: { id: orderId },
      include: { items: true, payment: true },
    });
    if (!order) return { ok: false as const, error: "ไม่พบออเดอร์" };
    if (order.payment?.status === "VERIFIED") {
      return { ok: false as const, error: "ชำระเงินนี้ยืนยันไปแล้ว" };
    }

    await tx.payment.update({
      where: { orderId },
      data: { status: "VERIFIED", verifiedAt: new Date(), verifiedById: user.id, rejectReason: null },
    });

    await tx.order.update({
      where: { id: orderId },
      data: { status: "PAID", updatedById: user.id },
    });

    // ตัดสต็อกสินค้า
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
    return { ok: true as const };
  });

  if (!result.ok) return result;
  revalidatePath(`/orders/${orderId}`);
  revalidatePath("/orders");
  return { ok: true, message: "ยืนยันการชำระเงินเรียบร้อย" };
}

export async function rejectPayment(orderId: string, reason: string): Promise<ActionResult> {
  await requireUser();
  await prisma.payment.update({
    where: { orderId },
    data: { status: "REJECTED", rejectReason: reason || "ยอดไม่ตรง / สลิปไม่ถูกต้อง" },
  });
  revalidatePath(`/orders/${orderId}`);
  return { ok: true, message: "ปฏิเสธการชำระเงินแล้ว แจ้งลูกค้าให้ส่งสลิปใหม่" };
}

const statusSchema = z.enum([
  "PENDING_PAYMENT",
  "PAID",
  "IN_PROGRESS",
  "COMPLETED",
  "CANCELLED",
]);

export async function updateOrderStatus(orderId: string, status: string): Promise<ActionResult> {
  const user = await requireUser();
  const parsed = statusSchema.safeParse(status);
  if (!parsed.success) return { ok: false, error: "สถานะไม่ถูกต้อง" };

  await prisma.order.update({
    where: { id: orderId },
    data: { status: parsed.data, updatedById: user.id },
  });
  revalidatePath(`/orders/${orderId}`);
  revalidatePath("/orders");
  return { ok: true, message: "อัปเดตสถานะเรียบร้อย" };
}
