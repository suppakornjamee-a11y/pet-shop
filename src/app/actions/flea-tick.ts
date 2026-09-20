"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireAdmin, requireStaffUser } from "@/lib/auth-helpers";
import { sendLinePush } from "@/lib/line";
import { FLEA_INFO_REQUEST_LOG_PREFIX, FLEA_STAFF_CHECKED_LOG } from "@/lib/order-log";
import type { ActionResult } from "./customers";

const unit = z.enum(["DAY", "WEEK", "MONTH"]);

const productSchema = z
  .object({
    id: z.string().optional(),
    name: z.string().trim().min(1, "กรุณากรอกชื่อยา"),
    formula: z.string().trim().optional(),
    aliases: z.array(z.string().trim().min(1)).default([]),
    species: z.enum(["DOG", "CAT"]).nullable(),
    form: z.enum(["CHEWABLE", "SPOT_ON", "COLLAR", "OTHER"]),
    tickValue: z.coerce.number().int().positive().nullable(),
    tickUnit: unit.nullable(),
    fleaValue: z.coerce.number().int().positive().nullable(),
    fleaUnit: unit.nullable(),
    bathNote: z.string().trim().optional(),
    labelSource: z.string().trim().optional(),
    note: z.string().trim().optional(),
    active: z.boolean().default(true),
  })
  .refine((d) => (d.tickValue == null) === (d.tickUnit == null), {
    message: "ระยะคุ้มครองเห็บต้องมีทั้งจำนวนและหน่วย หรือเว้นว่างทั้งคู่",
  })
  .refine((d) => (d.fleaValue == null) === (d.fleaUnit == null), {
    message: "ระยะคุ้มครองหมัดต้องมีทั้งจำนวนและหน่วย หรือเว้นว่างทั้งคู่",
  });

/**
 * บันทึกข้อมูลยา — ถ้าแก้ส่วนที่ใช้คำนวณ (ชนิดสัตว์ / ระยะคุ้มครอง) ของยาที่ยืนยันแล้ว
 * สถานะจะกลับเป็น "รอตรวจสอบ" ต้องยืนยันใหม่ ไม่ให้ตัวเลขที่ยังไม่ได้ตรวจหลุดไปใช้คำนวณ
 */
export async function upsertFleaTickProduct(input: unknown): Promise<ActionResult> {
  await requireAdmin();
  const parsed = productSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message };
  const { id, ...d } = parsed.data;
  const data = {
    ...d,
    formula: d.formula || null,
    bathNote: d.bathNote || null,
    labelSource: d.labelSource || null,
    note: d.note || null,
  };

  if (id) {
    const prev = await prisma.fleaTickProduct.findUnique({ where: { id } });
    if (!prev) return { ok: false, error: "ไม่พบยานี้" };
    const calcChanged =
      prev.species !== data.species ||
      prev.tickValue !== data.tickValue ||
      prev.tickUnit !== data.tickUnit ||
      prev.fleaValue !== data.fleaValue ||
      prev.fleaUnit !== data.fleaUnit;
    await prisma.fleaTickProduct.update({
      where: { id },
      data: calcChanged ? { ...data, status: "PENDING", verifiedById: null, verifiedAt: null } : data,
    });
  } else {
    await prisma.fleaTickProduct.create({ data });
  }
  revalidatePath("/settings/flea-tick");
  return { ok: true, message: "บันทึกข้อมูลยาเรียบร้อย" };
}

/** ผู้จัดการยืนยันว่าตรวจข้อมูลกับฉลากแล้ว — จากนี้ถึงนำไปคำนวณระยะคุ้มครอง */
export async function verifyFleaTickProduct(id: string): Promise<ActionResult> {
  const user = await requireAdmin();
  await prisma.fleaTickProduct.update({
    where: { id },
    data: { status: "VERIFIED", verifiedById: user.id, verifiedAt: new Date() },
  });
  revalidatePath("/settings/flea-tick");
  return { ok: true, message: "ยืนยันข้อมูลยาแล้ว" };
}

/**
 * พนักงานตรวจหลักฐาน (กล่องยา / ใบเสร็จ / สมุดสัตวแพทย์) แล้วเลือกยาที่ตรงกับหลักฐาน
 * บันทึกว่าใครตรวจ เมื่อไหร่ — เป็นการยืนยันข้อมูลที่บันทึก ไม่ใช่การรับรองว่าปลอดเห็บหมัด
 */
export async function confirmPetFleaTick(petId: string, productId: string): Promise<ActionResult> {
  const user = await requireStaffUser();
  const product = await prisma.fleaTickProduct.findFirst({ where: { id: productId, active: true } });
  if (!product) return { ok: false, error: "กรุณาเลือกยาจากฐานข้อมูล" };
  await prisma.pet.update({
    where: { id: petId },
    data: {
      fleaTickProductId: productId,
      fleaTickSource: "STAFF_CHECKED",
      fleaTickCheckedById: user.id,
      fleaTickCheckedAt: new Date(),
    },
  });
  revalidatePath("/settings/flea-tick");
  return { ok: true, message: "บันทึกผลตรวจหลักฐานแล้ว" };
}

/**
 * พนักงานตรวจข้อมูล/หลักฐานยาเห็บหมัดของออเดอร์นี้แล้ว (ตอนเช็คคิว) — บันทึกว่าใครตรวจเมื่อไหร่ที่สัตว์เลี้ยงและประวัติออเดอร์
 * เป็นการยืนยันข้อมูลที่บันทึกไว้ ไม่ใช่การรับรองว่าปลอดเห็บหมัด
 */
export async function confirmOrderFleaTick(orderId: string): Promise<ActionResult> {
  const user = await requireStaffUser();
  const order = await prisma.order.findUnique({
    where: { id: orderId },
    select: {
      id: true,
      pet: { select: { id: true, fleaTickMedicine: true, lastFleaTickAt: true, fleaTickProductId: true } },
    },
  });
  if (!order?.pet) return { ok: false, error: "ไม่พบสัตว์เลี้ยงของออเดอร์นี้" };
  const pet = order.pet;
  if (!pet.fleaTickMedicine && !pet.lastFleaTickAt && !pet.fleaTickProductId) {
    return { ok: false, error: "สัตว์เลี้ยงยังไม่มีข้อมูลยาเห็บหมัดให้ตรวจ" };
  }
  await prisma.$transaction([
    prisma.pet.update({
      where: { id: pet.id },
      data: { fleaTickSource: "STAFF_CHECKED", fleaTickCheckedById: user.id, fleaTickCheckedAt: new Date() },
    }),
    prisma.orderActivityLog.create({
      data: { orderId, action: FLEA_STAFF_CHECKED_LOG, createdById: user.id },
    }),
  ]);
  revalidatePath(`/orders/${orderId}`);
  revalidatePath("/settings/flea-tick");
  return { ok: true, message: "บันทึกผลตรวจยาเห็บหมัดแล้ว" };
}

/** พนักงานขอข้อมูลยาเห็บหมัดเพิ่มจากลูกค้าทาง LINE (เช่น ขอวันที่ให้ยาล่าสุดหรือรูปกล่องยา) — ลูกค้าตอบกลับในแชทร้านตามปกติ */
export async function requestOrderFleaTickInfo(orderId: string, message: string): Promise<ActionResult> {
  const user = await requireStaffUser();
  const note = message.trim();
  if (!note) return { ok: false, error: "กรุณาพิมพ์ข้อความถึงลูกค้า" };
  const order = await prisma.order.findUnique({
    where: { id: orderId },
    select: { id: true, pet: { select: { name: true } }, customer: { select: { lineUserId: true } } },
  });
  if (!order) return { ok: false, error: "ไม่พบออเดอร์" };
  const lineUserId = order.customer?.lineUserId;
  if (!lineUserId) return { ok: false, error: "ลูกค้ายังไม่ได้ผูก LINE จึงส่งข้อความไม่ได้" };
  try {
    await sendLinePush(
      lineUserId,
      `ร้านขอข้อมูลยาเห็บหมัดเพิ่มเติม${order.pet ? `ของน้อง${order.pet.name}` : ""}ค่ะ\n${note}`
    );
  } catch (e) {
    console.error("[LINE] flea info request push failed:", e);
    return { ok: false, error: "ส่งข้อความ LINE ไม่สำเร็จ กรุณาลองใหม่อีกครั้ง" };
  }
  await prisma.orderActivityLog.create({
    data: { orderId, action: `${FLEA_INFO_REQUEST_LOG_PREFIX}${note}`, createdById: user.id },
  });
  revalidatePath(`/orders/${orderId}`);
  return { ok: true, message: "ส่งข้อความถึงลูกค้าแล้ว" };
}
