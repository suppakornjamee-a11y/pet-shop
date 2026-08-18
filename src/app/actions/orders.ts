"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth-helpers";
import { generateOrderCode } from "@/lib/order-code";
import { buildPromptPayPayload } from "@/lib/promptpay";
import {
  buildSlotDate,
  daysBetween,
  isValidDateStr,
  isValidTimeStr,
} from "@/lib/slots";
import { isSlotHolding } from "@/lib/booking";
import { isRoomAvailable } from "@/lib/room-availability";
import { sendLinePush } from "@/lib/line";
import { formatBaht } from "@/lib/format";
import type { RoomModel, RoomCategoryModel } from "@/generated/prisma/models";
import type { ActionResult } from "./customers";

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
  } catch {
    // ไม่ให้ error การแจ้งเตือนไปกระทบ flow หลัก (ยืนยันชำระเงิน/อัปเดตสถานะ)
  }
}

const PAYMENT_TTL_MS = 15 * 60 * 1000; // 15 นาที

const createOrderSchema = z.object({
  customerId: z.string().min(1, "กรุณาเลือกลูกค้า"),
  petId: z.string().optional().nullable(),
  roomId: z.string().optional().nullable(),
  checkInDate: z.string().optional(),
  checkInTime: z.string().optional(),
  checkOutDate: z.string().optional(),
  checkOutTime: z.string().optional(),
  nanny: z.coerce.boolean().default(false),
  depositAmount: z.coerce.number().int().min(0).default(0),
  vaccineComplete: z.coerce.boolean().default(false),
  lastFleaTickDate: z.string().optional(),
  fleaTickMedicine: z.string().optional(),
  note: z.string().optional(),
  serviceIds: z.array(z.string()).default([]),
  productLines: z
    .array(z.object({ productId: z.string(), quantity: z.coerce.number().int().min(1) }))
    .default([]),
  appointmentDate: z.string().optional(),
  appointmentTime: z.string().optional(),
  queueType: z.enum(["BATH", "OTHER"]).default("BATH"),
});

type OrderFormData = z.infer<typeof createOrderSchema>;

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

type OrderItemInput = {
  itemType: "SERVICE" | "ROOM" | "PRODUCT";
  refId: string;
  name: string;
  unitPrice: number;
  quantity: number;
  subtotal: number;
};

type RoomWithCategory = RoomModel & { category: RoomCategoryModel };

/**
 * ประมวลผล + ตรวจสอบข้อมูลฟอร์มออเดอร์ทั้งหมด (ใช้ร่วมกันทั้งสร้างและแก้ไข)
 * - ถ้ามีบริการอาบน้ำ/ตัดขน (คิวส่วนกลาง) หรือไม่มีห้อง → ต้องเลือกคิวจากปฏิทิน
 * - ถ้ามีห้อง → ต้องระบุวัน-เวลาเช็คอิน/เช็คเอาท์ และห้องต้องว่างในช่วงนั้น
 */
async function buildOrderPlan(
  data: OrderFormData,
  excludeOrderId?: string
): Promise<
  | {
      ok: true;
      appointmentAt: Date | null;
      checkInAt: Date | null;
      checkOutAt: Date | null;
      nights: number;
      items: OrderItemInput[];
      subtotal: number;
      room: NonNullable<RoomWithCategory>;
    }
  | { ok: true; room: null; appointmentAt: Date | null; checkInAt: null; checkOutAt: null; nights: 0; items: OrderItemInput[]; subtotal: number }
  | { ok: false; error: string }
> {
  const hasSomething =
    data.serviceIds.length > 0 || data.productLines.length > 0 || !!data.roomId;
  if (!hasSomething) {
    return { ok: false, error: "กรุณาเพิ่มบริการ ห้องพัก หรือสินค้าอย่างน้อย 1 รายการ" };
  }

  const [services, room, products] = await Promise.all([
    data.serviceIds.length
      ? prisma.service.findMany({ where: { id: { in: data.serviceIds } } })
      : Promise.resolve([]),
    data.roomId
      ? prisma.room.findUnique({ where: { id: data.roomId }, include: { category: true } })
      : Promise.resolve(null),
    data.productLines.length
      ? prisma.product.findMany({ where: { id: { in: data.productLines.map((p) => p.productId) } } })
      : Promise.resolve([]),
  ]);

  // ถ้ามีห้อง ใช้เวลาเช็คอิน/เช็คเอาท์เป็นตัวอ้างอิงแทนคิวส่วนกลาง — แม้จะมีบริการอาบน้ำ/ตัดขนติดมาด้วยก็ไม่ต้องเลือกคิวซ้ำ
  const needsAppointment = !room;

  let appointmentAt: Date | null = null;
  if (needsAppointment) {
    const { appointmentDate, appointmentTime } = data;
    if (
      !appointmentDate ||
      !appointmentTime ||
      !isValidDateStr(appointmentDate) ||
      !isValidTimeStr(appointmentTime)
    ) {
      return { ok: false, error: "กรุณาเลือกวันและเวลาคิวจากปฏิทินก่อนสร้างออเดอร์" };
    }
    appointmentAt = buildSlotDate(appointmentDate, appointmentTime);
    if (appointmentAt.getTime() < Date.now()) {
      return { ok: false, error: "ไม่สามารถจองคิวย้อนหลังได้ กรุณาเลือกเวลาในอนาคต" };
    }
    if (!(await isSlotAvailable(appointmentDate, appointmentTime, excludeOrderId, data.queueType))) {
      return { ok: false, error: "ช่วงเวลานี้มีคิวแล้ว กรุณาเลือกช่วงเวลาอื่น" };
    }
  }

  let checkInAt: Date | null = null;
  let checkOutAt: Date | null = null;
  let nights = 0;
  if (room) {
    const { checkInDate, checkInTime, checkOutDate, checkOutTime } = data;
    if (
      !checkInDate ||
      !checkInTime ||
      !checkOutDate ||
      !checkOutTime ||
      !isValidDateStr(checkInDate) ||
      !isValidTimeStr(checkInTime) ||
      !isValidDateStr(checkOutDate) ||
      !isValidTimeStr(checkOutTime)
    ) {
      return { ok: false, error: "กรุณาระบุวัน-เวลาเช็คอินและเช็คเอาท์ของห้อง/พื้นที่" };
    }
    checkInAt = buildSlotDate(checkInDate, checkInTime);
    checkOutAt = buildSlotDate(checkOutDate, checkOutTime);
    if (checkOutAt.getTime() <= checkInAt.getTime()) {
      return { ok: false, error: "เวลาเช็คเอาท์ต้องอยู่หลังเวลาเช็คอิน" };
    }
    if (room.category.billingUnit === "PER_VISIT" && checkInDate !== checkOutDate) {
      return { ok: false, error: "การจองแบบรายครั้ง (Daycare/Pawsome) ต้องเช็คอิน-เช็คเอาท์วันเดียวกัน" };
    }
    nights =
      room.category.billingUnit === "PER_NIGHT"
        ? Math.max(1, daysBetween(checkInDate, checkOutDate))
        : 0;
    if (!(await isRoomAvailable(room.id, checkInAt, checkOutAt, excludeOrderId))) {
      return { ok: false, error: "ห้อง/พื้นที่นี้ถูกจองในช่วงเวลาดังกล่าวแล้ว กรุณาเลือกห้องหรือช่วงเวลาอื่น" };
    }
  }

  const items: OrderItemInput[] = [];
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
  if (room) {
    const qty = nights > 0 ? nights : 1;
    const unitLabel = nights > 0 ? `${nights} คืน` : "1 ครั้ง";
    items.push({
      itemType: "ROOM",
      refId: room.id,
      name: `${room.category.name} ${room.name} (${unitLabel})`,
      unitPrice: room.pricePerNight,
      quantity: qty,
      subtotal: room.pricePerNight * qty,
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
  if (data.depositAmount > subtotal) {
    return { ok: false, error: "มัดจำต้องไม่มากกว่ายอดรวมออเดอร์" };
  }

  if (room) {
    return { ok: true, appointmentAt, checkInAt, checkOutAt, nights, items, subtotal, room };
  }
  return { ok: true, appointmentAt, checkInAt: null, checkOutAt: null, nights: 0, items, subtotal, room: null };
}

function parseFleaTickDate(dateStr: string | undefined): Date | null {
  return dateStr && isValidDateStr(dateStr) ? buildSlotDate(dateStr, "00:00") : null;
}

export async function createOrder(input: unknown): Promise<ActionResult> {
  const user = await requireUser();
  const parsed = createOrderSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message };
  const data = parsed.data;

  const plan = await buildOrderPlan(data);
  if (!plan.ok) return plan;

  const total = plan.subtotal;
  const lastFleaTickAt = parseFleaTickDate(data.lastFleaTickDate);

  // ลองสร้างพร้อม retry เผื่อรหัสชนกัน (P2002)
  let order: { id: string } | null = null;
  for (let attempt = 0; attempt < 5; attempt++) {
    const code = await generateOrderCode();
    try {
      order = await prisma.order.create({
        data: {
          code,
          customerId: data.customerId,
          petId: data.petId || null,
          roomId: plan.room?.id ?? null,
          nights: plan.nights,
          appointmentAt: plan.appointmentAt,
          queueType: plan.appointmentAt ? data.queueType : null,
          checkInAt: plan.checkInAt,
          checkOutAt: plan.checkOutAt,
          nanny: data.nanny,
          depositAmount: data.depositAmount,
          vaccineComplete: data.vaccineComplete,
          lastFleaTickAt,
          fleaTickMedicine: data.fleaTickMedicine || null,
          subtotal: plan.subtotal,
          total,
          note: data.note || null,
          createdById: user.id,
          updatedById: user.id,
          status: "PENDING_PAYMENT",
          items: { create: plan.items },
        },
      });
      break;
    } catch (e) {
      const isDup = (e as { code?: string })?.code === "P2002";
      if (isDup && attempt < 4) continue; // รหัสชน — สร้างเลขใหม่แล้วลองอีก
      throw e;
    }
  }
  if (!order) return { ok: false, error: "สร้างออเดอร์ไม่สำเร็จ กรุณาลองใหม่" };

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

  await createInitialPayments(order.id, total, data.depositAmount);

  revalidatePath("/orders/bath");
  revalidatePath("/orders/other");
  revalidatePath("/boarding");
  return { ok: true, id: order.id, message: "สร้างออเดอร์เรียบร้อย" };
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

  const plan = await buildOrderPlan(data, orderId);
  if (!plan.ok) return plan;

  const total = plan.subtotal;
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
        nanny: data.nanny,
        depositAmount: data.depositAmount,
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

  await createInitialPayments(orderId, total, data.depositAmount);

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
async function createInitialPayments(orderId: string, total: number, depositAmount: number) {
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
    include: { payments: true },
  });
  if (!order) return { ok: false, error: "ไม่พบออเดอร์" };
  // เก็บส่วนที่เหลือได้ตราบใดที่ยังไม่ยกเลิกและยังไม่เคยมัดจำ/ชำระอะไรเลย (แม้งานจะเสร็จ/เช็คเอาท์ไปแล้วก็ตาม)
  if (order.status === "PENDING_PAYMENT") {
    return { ok: false, error: "ออเดอร์นี้ยังไม่ได้ชำระมัดจำ" };
  }
  if (order.status === "CANCELLED") {
    return { ok: false, error: "ออเดอร์นี้ถูกยกเลิกแล้ว" };
  }
  const hasOpenPayment = order.payments.some((p) => p.status !== "VERIFIED" && p.status !== "REJECTED");
  if (hasOpenPayment) {
    return { ok: false, error: "มีรายการชำระเงินที่ยังไม่เสร็จสิ้นอยู่แล้ว" };
  }
  const verifiedSum = order.payments
    .filter((p) => p.status === "VERIFIED")
    .reduce((sum, p) => sum + p.amount, 0);
  const remaining = order.total - verifiedSum;
  if (remaining <= 0) {
    return { ok: false, error: "ไม่มียอดคงเหลือให้เก็บแล้ว" };
  }

  await insertPayment(orderId, remaining, "BALANCE");
  revalidatePath(`/orders/${orderId}`);
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

export async function markSlipSubmitted(paymentId: string, slipUrl?: string): Promise<ActionResult> {
  await requireUser();
  const payment = await prisma.payment.update({
    where: { id: paymentId },
    data: { status: "SUBMITTED", submittedAt: new Date(), slipUrl: slipUrl || null },
  });
  revalidatePath(`/orders/${payment.orderId}`);
  return { ok: true, message: "บันทึกการอัปโหลดสลิปแล้ว รอตรวจสอบ" };
}

export async function verifyPayment(paymentId: string): Promise<ActionResult> {
  const user = await requireUser();

  const lookup = await prisma.payment.findUnique({ where: { id: paymentId }, select: { orderId: true } });
  if (!lookup) return { ok: false, error: "ไม่พบรายการชำระเงิน" };
  const orderId = lookup.orderId;

  const result = await prisma.$transaction(async (tx) => {
    const payment = await tx.payment.findUnique({
      where: { id: paymentId },
      include: { order: { include: { items: true, payments: true } } },
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

    return { ok: true as const, justFullyPaid, orderCode: order.code, orderTotal: order.total };
  });

  revalidatePath(`/orders/${orderId}`);
  if (!result.ok) return result;
  revalidatePath("/orders/bath");
  revalidatePath("/orders/other");
  revalidatePath("/boarding");

  if (result.justFullyPaid) {
    void notifyCustomerLine(
      orderId,
      `ชำระเงินสำเร็จแล้ว ✅\nออเดอร์ ${result.orderCode}\nยอด ${formatBaht(result.orderTotal)}\nขอบคุณที่ใช้บริการค่ะ 🐾`
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

export async function updateOrderStatus(orderId: string, status: string): Promise<ActionResult> {
  const user = await requireUser();
  const parsed = statusSchema.safeParse(status);
  if (!parsed.success) return { ok: false, error: "สถานะไม่ถูกต้อง" };

  const order = await prisma.order.update({
    where: { id: orderId },
    data: { status: parsed.data, updatedById: user.id },
  });
  revalidatePath(`/orders/${orderId}`);
  revalidatePath("/orders/bath");
  revalidatePath("/orders/other");
  revalidatePath("/boarding");

  if (parsed.data === "COMPLETED") {
    void notifyCustomerLine(
      orderId,
      `บริการเสร็จเรียบร้อยแล้วค่ะ 🎉\nออเดอร์ ${order.code}\nสามารถมารับได้เลยค่ะ 🐾`
    );
  }

  return { ok: true, message: "อัปเดตสถานะเรียบร้อย" };
}
