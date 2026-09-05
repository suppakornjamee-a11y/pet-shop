"use server";

// ไฟล์นี้เรียกได้โดยไม่ต้องล็อกอิน (เข้าถึงผ่าน LINE LIFF mini-app เท่านั้น) — ห้าม import
// requireUser/requireStaffUser มาใช้ที่นี่ ทุกฟังก์ชันต้องยืนยันตัวตนด้วย verifyLiffIdToken() ก่อนเสมอ
// และห้ามเพิ่มฟังก์ชันแก้ไข/ยืนยัน/ปฏิเสธ/เปลี่ยนสถานะออเดอร์-การชำระเงินที่มีอยู่แล้ว
// — ไฟล์นี้ทำได้แค่ "สร้างใหม่" เท่านั้น ตามขอบเขต v1 (ดูแผนงาน lexical-coalescing-crystal.md)

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { verifyLiffIdToken } from "@/lib/line";
import { customerSchema, petRegisterSchema, petCreateData } from "@/lib/customer-schema";
import { buildOrderPlan, persistOrder, type OrderFormData } from "@/lib/order-plan";
import { createInitialPayments } from "./orders";
import { isSlotAvailable } from "@/lib/booking";
import { isRoomAvailable } from "@/lib/room-availability";
import { isPastSlot, isValidDateStr, isValidTimeStr, buildSlotDate, toThaiDateStr } from "@/lib/slots";
import type { ActionResult } from "./customers";

// ช่วงเวลาคิวจองเองผ่าน LINE — ทุก 30 นาที ตั้งแต่ 10:00 ถึง 20:00 (จองได้ล่าสุดคือช่วง 19:30-20:00)
// แยกจาก TIME_SLOTS ที่พนักงานใช้ในปฏิทินหลังบ้านโดยตั้งใจ เพราะช่วงเวลาที่เปิดให้ลูกค้าจองเอง
// ไม่จำเป็นต้องตรงกับที่พนักงานรับ walk-in ได้ (ใช้ตรรกะเช็คคิวว่างชุดเดียวกันอยู่ดี — isSlotAvailable)
const LIFF_TIME_SLOTS: string[] = Array.from({ length: 20 }, (_, i) => {
  const totalMin = 10 * 60 + i * 30;
  return `${String(Math.floor(totalMin / 60)).padStart(2, "0")}:${String(totalMin % 60).padStart(2, "0")}`;
});

function maskName(name: string): string {
  return name
    .split(" ")
    .map((p) => (p.length <= 1 ? p : p[0] + "*".repeat(p.length - 1)))
    .join(" ");
}

const PET_SELECT = {
  id: true,
  name: true,
  species: true,
  photoUrls: true,
} as const;

/** เรียกตอนเปิดแอปครั้งแรก — เช็คว่า LINE บัญชีนี้เคยผูกกับลูกค้ารายไหนไว้แล้วหรือยัง */
export async function liffBootstrap(idToken: string) {
  const identity = await verifyLiffIdToken(idToken);
  if (!identity) {
    return { ok: false as const, error: "เซสชัน LINE ไม่ถูกต้อง กรุณาเปิดใหม่จากแอป LINE", code: "LIFF_AUTH_EXPIRED" as const };
  }

  const customer = await prisma.customer.findUnique({
    where: { lineUserId: identity.userId },
    select: { id: true, name: true, nickname: true, pets: { select: PET_SELECT } },
  });
  if (!customer) return { ok: true as const, linked: false as const, displayName: identity.name ?? null };

  return {
    ok: true as const,
    linked: true as const,
    customer: { id: customer.id, name: customer.name, nickname: customer.nickname, pets: customer.pets },
  };
}

/** ค้นหาลูกค้าเก่าด้วยเบอร์โทร (สำหรับลูกค้าที่เคยลงทะเบียนไว้แล้วแต่ยังไม่เคยผูก LINE)
 * คืนแค่ชื่อแบบเซ็นเซอร์บางส่วน — ยังไม่เปิดเผยข้อมูลเต็มจนกว่าจะยืนยันตัวตนด้วย liffConfirmLink */
export async function liffFindCustomerByPhone(idToken: string, phone: string) {
  const identity = await verifyLiffIdToken(idToken);
  if (!identity) {
    return { ok: false as const, error: "เซสชัน LINE ไม่ถูกต้อง กรุณาเปิดใหม่จากแอป LINE", code: "LIFF_AUTH_EXPIRED" as const };
  }

  const q = phone.trim();
  if (q.length < 6) return { ok: false as const, error: "กรุณากรอกเบอร์โทรให้ครบ" };

  const matches = await prisma.customer.findMany({
    where: { phone: q },
    select: { id: true, name: true, pets: { select: { species: true } } },
    take: 5,
  });

  return {
    ok: true as const,
    matches: matches.map((c) => ({
      customerId: c.id,
      maskedName: maskName(c.name),
      petSummary: c.pets.length > 0 ? `มีสัตว์เลี้ยง ${c.pets.length} ตัว` : "ยังไม่มีข้อมูลสัตว์เลี้ยง",
    })),
  };
}

/** ลูกค้ากดยืนยันว่า "ใช่ นี่คือฉัน" จากรายการที่ค้นเจอ — ผูก LINE userId เข้ากับลูกค้ารายนั้น */
export async function liffConfirmLink(
  idToken: string,
  customerId: string
): Promise<ActionResult & { pets?: { id: string; name: string; species: "DOG" | "CAT" }[] }> {
  const identity = await verifyLiffIdToken(idToken);
  if (!identity) {
    return { ok: false, error: "เซสชัน LINE ไม่ถูกต้อง กรุณาเปิดใหม่จากแอป LINE", code: "LIFF_AUTH_EXPIRED" };
  }

  const existing = await prisma.customer.findUnique({ where: { id: customerId } });
  if (!existing) return { ok: false, error: "ไม่พบข้อมูลลูกค้า" };
  if (existing.lineUserId && existing.lineUserId !== identity.userId) {
    return { ok: false, error: "บัญชีลูกค้านี้ผูกกับ LINE บัญชีอื่นไว้แล้ว กรุณาติดต่อเจ้าหน้าที่ที่ร้าน" };
  }

  try {
    const customer = await prisma.customer.update({
      where: { id: customerId },
      data: { lineUserId: identity.userId },
      select: { id: true, pets: { select: { id: true, name: true, species: true } } },
    });
    return { ok: true, id: customer.id, pets: customer.pets };
  } catch (e) {
    if ((e as { code?: string })?.code === "P2002") {
      return { ok: false, error: "บัญชี LINE นี้ผูกกับลูกค้ารายอื่นอยู่แล้ว กรุณาติดต่อเจ้าหน้าที่ที่ร้าน" };
    }
    throw e;
  }
}

/** ลงทะเบียนลูกค้าใหม่ + สัตว์เลี้ยง พร้อมผูก LINE userId ให้อัตโนมัติในขั้นตอนเดียวกันเลย */
export async function liffRegisterCustomer(
  idToken: string,
  input: { customer: unknown; pets: unknown }
): Promise<ActionResult> {
  const identity = await verifyLiffIdToken(idToken);
  if (!identity) {
    return { ok: false, error: "เซสชัน LINE ไม่ถูกต้อง กรุณาเปิดใหม่จากแอป LINE", code: "LIFF_AUTH_EXPIRED" };
  }

  const customer = customerSchema.safeParse(input.customer);
  if (!customer.success) return { ok: false, error: customer.error.issues[0].message };

  const petsParsed = z
    .array(petRegisterSchema)
    .min(1, "ต้องมีสัตว์เลี้ยงอย่างน้อย 1 ตัว")
    .safeParse(input.pets);
  if (!petsParsed.success) return { ok: false, error: petsParsed.error.issues[0].message };

  try {
    const created = await prisma.customer.create({
      data: {
        ...customer.data,
        lineUserId: identity.userId,
        createdVia: "LIFF",
        pets: { create: petsParsed.data.map(petCreateData) },
      },
    });
    return { ok: true, id: created.id, message: "ลงทะเบียนเรียบร้อย" };
  } catch (e) {
    if ((e as { code?: string })?.code === "P2002") {
      return { ok: false, error: "บัญชี LINE นี้มีข้อมูลลูกค้าลงทะเบียนไว้แล้ว กรุณาใช้ตัวเลือก \"เคยเป็นลูกค้าอยู่แล้ว\" แทน" };
    }
    throw e;
  }
}

/** ดึงข้อมูลโปรไฟล์ (เจ้าของ+สัตว์เลี้ยงทั้งหมด) ของ lineUserId นี้เอง — ใช้เติมฟอร์มแก้ไขโปรไฟล์
 * ให้ตรงกับข้อมูลที่มีอยู่จริง (โครงสร้างเดียวกับที่หน้าแก้ไขลูกค้าฝั่งพนักงานใช้) */
export async function liffGetProfile(idToken: string) {
  const identity = await verifyLiffIdToken(idToken);
  if (!identity) {
    return { ok: false as const, error: "เซสชันหมดอายุ กรุณาเปิดลิงก์นี้ใหม่จาก LINE", code: "LIFF_AUTH_EXPIRED" as const };
  }

  const customer = await prisma.customer.findUnique({
    where: { lineUserId: identity.userId },
    include: { pets: { orderBy: { createdAt: "asc" } } },
  });
  if (!customer) {
    return { ok: false as const, error: "ไม่พบข้อมูลลูกค้า กรุณาลงทะเบียนก่อน", notRegistered: true as const };
  }

  return {
    ok: true as const,
    customerId: customer.id,
    customer: {
      name: customer.name,
      nickname: customer.nickname ?? "",
      phone: customer.phone,
      email: customer.email ?? "",
      lineId: customer.lineId ?? "",
      address: customer.address ?? "",
      petInstagram: customer.petInstagram ?? "",
      preferredLanguage: customer.preferredLanguage,
      note: customer.note ?? "",
    },
    pets: customer.pets.map((p) => ({
      id: p.id,
      name: p.name,
      species: p.species,
      breed: p.breed ?? "",
      gender: p.gender,
      birthDate: p.birthDate ? toThaiDateStr(p.birthDate) : "",
      weightKg: p.weightKg != null ? String(p.weightKg) : "",
      color: p.color ?? "",
      personality: p.personality ?? "",
      aggressiveNotes: p.aggressiveNotes ?? "",
      allergies: p.allergies ?? "",
      vaccine5in1Date: p.vaccine5in1At ? toThaiDateStr(p.vaccine5in1At) : "",
      rabiesVaccineDate: p.rabiesVaccineAt ? toThaiDateStr(p.rabiesVaccineAt) : "",
      lastFleaTickDate: p.lastFleaTickAt ? toThaiDateStr(p.lastFleaTickAt) : "",
      fleaTickMedicine: p.fleaTickMedicine ?? "",
      foodNote: p.foodNote ?? "",
      medicationNote: p.medicationNote ?? "",
      neutered: p.neutered,
      note: p.note ?? "",
      photoUrls: p.photoUrls,
      vaccinePhotoUrls: p.vaccinePhotoUrls,
      vaccineComplete: p.vaccineComplete ?? false,
    })),
  };
}

const petWithOptionalIdSchema = petRegisterSchema.extend({ id: z.string().optional() });

/** ลูกค้าแก้ไขข้อมูลโปรไฟล์ของตัวเอง (เจ้าของ+สัตว์เลี้ยง) — เช็คว่าสัตว์เลี้ยงทุกตัวที่ส่ง id มาแก้ไข
 * เป็นของ lineUserId นี้จริงก่อนเสมอ กันแก้ไขข้อมูลสัตว์เลี้ยง/ลูกค้าคนอื่นโดยปลอม id ส่งมา
 * ตรรกะบันทึกเหมือน updateCustomerWithPets ฝั่งพนักงานทุกประการ (ดู src/app/actions/customers.ts) */
export async function liffUpdateProfile(
  idToken: string,
  input: { customer: unknown; pets: unknown }
): Promise<ActionResult> {
  const identity = await verifyLiffIdToken(idToken);
  if (!identity) {
    return { ok: false, error: "เซสชัน LINE หมดอายุ กรุณาเปิดหน้านี้ใหม่จากแอป LINE", code: "LIFF_AUTH_EXPIRED" };
  }
  const existing = await prisma.customer.findUnique({ where: { lineUserId: identity.userId } });
  if (!existing) return { ok: false, error: "ไม่พบข้อมูลลูกค้า" };

  const customer = customerSchema.safeParse(input.customer);
  if (!customer.success) return { ok: false, error: customer.error.issues[0].message };

  const petsParsed = z
    .array(petWithOptionalIdSchema)
    .min(1, "ต้องมีสัตว์เลี้ยงอย่างน้อย 1 ตัว")
    .safeParse(input.pets);
  if (!petsParsed.success) return { ok: false, error: petsParsed.error.issues[0].message };

  const petIds = petsParsed.data.map((p) => p.id).filter((id): id is string => !!id);
  if (petIds.length > 0) {
    const ownedCount = await prisma.pet.count({ where: { id: { in: petIds }, customerId: existing.id } });
    if (ownedCount !== petIds.length) return { ok: false, error: "ไม่พบสัตว์เลี้ยงนี้ในบัญชีของคุณ" };
  }

  await prisma.$transaction(async (tx) => {
    await tx.customer.update({ where: { id: existing.id }, data: customer.data });
    for (const p of petsParsed.data) {
      if (p.id) {
        await tx.pet.update({ where: { id: p.id }, data: petCreateData(p) });
      } else {
        await tx.pet.create({ data: { customerId: existing.id, ...petCreateData(p) } });
      }
    }
  });

  revalidatePath(`/customers/${existing.id}`);
  return { ok: true, id: existing.id, message: "บันทึกข้อมูลเรียบร้อย" };
}

/** รายการบริการที่เปิดให้จองเอง — ไม่โชว์ค่าคอมมิชชั่นพนักงาน (ข้อมูลภายใน) */
export async function getBookableServices(kind: "BATH" | "OTHER" | "BOARDING") {
  return prisma.service.findMany({
    where: {
      active: true,
      ...(kind === "OTHER"
        ? { category: "OTHER" as const }
        : kind === "BATH"
          ? { category: { in: ["BATH", "GROOMING"] } }
          : { category: "BOARDING" as const }),
    },
    select: {
      id: true,
      name: true,
      category: true,
      group: true,
      speciesScope: true,
      defaultOn: true,
      sortOrder: true,
      price: true,
    },
    orderBy: [{ category: "asc" }, { sortOrder: "asc" }],
  });
}

/** รายการห้องพักที่เปิดให้จองเอง — ไม่โชว์รุ่น/serial กล้องวงจรปิด (ข้อมูลภายใน) */
export async function getBookableRooms() {
  return prisma.room.findMany({
    where: { active: true },
    select: {
      id: true,
      categoryId: true,
      name: true,
      sortOrder: true,
      hasAir: true,
      hasFan: true,
      pricePerNight: true,
      equipment: true,
      category: { select: { id: true, name: true, billingUnit: true, sortOrder: true } },
    },
    orderBy: [{ category: { sortOrder: "asc" } }, { sortOrder: "asc" }],
  });
}

/** เช็คว่าห้องนี้ว่างในช่วงที่เลือกไหม — ใช้ตรรกะเดียวกับที่ระบบใช้ตัดสินจริงตอนสร้างออเดอร์ */
export async function checkRoomAvailability(
  roomId: string,
  checkInDate: string,
  checkInTime: string,
  checkOutDate: string,
  checkOutTime: string
): Promise<boolean> {
  if (
    !isValidDateStr(checkInDate) ||
    !isValidDateStr(checkOutDate) ||
    !isValidTimeStr(checkInTime) ||
    !isValidTimeStr(checkOutTime)
  ) {
    return false;
  }
  const checkInAt = buildSlotDate(checkInDate, checkInTime);
  const checkOutAt = buildSlotDate(checkOutDate, checkOutTime);
  if (checkOutAt.getTime() <= checkInAt.getTime()) return false;
  return isRoomAvailable(roomId, checkInAt, checkOutAt);
}

/** คิวที่ว่างของวันนั้น (อาบน้ำ/บริการอื่นๆ) — ใช้ตรรกะเดียวกับปฏิทินฝั่งพนักงาน กันไม่ให้ขัดกัน */
export async function getOpenSlots(dateStr: string, queueType: "BATH" | "OTHER" = "BATH") {
  if (!isValidDateStr(dateStr)) return [];
  return Promise.all(
    LIFF_TIME_SLOTS.map(async (time) => ({
      time,
      available: !isPastSlot(dateStr, time) && (await isSlotAvailable(dateStr, time, undefined, queueType)),
    }))
  );
}

const liffCreateOrderSchema = z.object({
  petId: z.string().min(1, "กรุณาเลือกสัตว์เลี้ยง"),
  roomId: z.string().optional().nullable(),
  checkInDate: z.string().optional(),
  checkInTime: z.string().optional(),
  checkOutDate: z.string().optional(),
  checkOutTime: z.string().optional(),
  nannyType: z.enum(["NONE", "REGULAR", "VIP"]).default("NONE"),
  cctvRequested: z.coerce.boolean().default(false),
  note: z.string().max(500).optional(),
  serviceIds: z.array(z.string()).default([]),
  appointmentDate: z.string().optional(),
  appointmentTime: z.string().optional(),
  queueType: z.enum(["BATH", "OTHER"]).default("BATH"),
});

/** ลูกค้าจองเอง — สร้างออเดอร์ + payment แรกให้เลย (เหมือนที่พนักงานสร้างให้ทุกประการ)
 * ไม่รับสินค้า/ขนมเพิ่มเติมในเวอร์ชันแรก และห้ามรับ customerId จาก client เด็ดขาด — ต้องดึงจาก
 * lineUserId ที่ยืนยันแล้วเท่านั้น ป้องกันคนแปลกหน้าสั่งจองในชื่อลูกค้ารายอื่น */
export async function liffCreateOrder(idToken: string, input: unknown): Promise<ActionResult> {
  const identity = await verifyLiffIdToken(idToken);
  if (!identity) {
    return { ok: false, error: "เซสชัน LINE หมดอายุ กรุณาเปิดหน้านี้ใหม่จากแอป LINE", code: "LIFF_AUTH_EXPIRED" };
  }

  const customer = await prisma.customer.findUnique({ where: { lineUserId: identity.userId } });
  if (!customer) return { ok: false, error: "ไม่พบข้อมูลลูกค้า กรุณาลงทะเบียนก่อน" };

  const parsed = liffCreateOrderSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message };
  const data = parsed.data;

  // buildOrderPlan ไม่เช็คว่า petId เป็นของ customerId นี้จริงไหม (ฝั่งพนักงานเลือกจากลูกค้าที่ค้นแล้วเท่านั้น
  // จึงพลาดไม่ได้ แต่ฝั่งสาธารณะต้องเช็คเองตรงนี้ ป้องกันส่ง petId ของคนอื่นมาแอบจอง)
  const pet = await prisma.pet.findUnique({ where: { id: data.petId } });
  if (!pet || pet.customerId !== customer.id) {
    return { ok: false, error: "ไม่พบสัตว์เลี้ยงนี้ในบัญชีของคุณ" };
  }

  const planInput: OrderFormData = {
    customerId: customer.id,
    petId: data.petId,
    roomId: data.roomId || null,
    checkInDate: data.checkInDate,
    checkInTime: data.checkInTime,
    checkOutDate: data.checkOutDate,
    checkOutTime: data.checkOutTime,
    nannyType: data.nannyType,
    cctvRequested: data.cctvRequested,
    depositAmount: 0,
    vaccineComplete: pet.vaccineComplete ?? false,
    lastFleaTickDate: pet.lastFleaTickAt ? toThaiDateStr(pet.lastFleaTickAt) : undefined,
    fleaTickMedicine: pet.fleaTickMedicine ?? undefined,
    note: data.note,
    serviceIds: data.serviceIds,
    productLines: [],
    appointmentDate: data.appointmentDate,
    appointmentTime: data.appointmentTime,
    queueType: data.queueType,
  };

  const plan = await buildOrderPlan(planInput);
  if (!plan.ok) return plan;

  const result = await persistOrder(plan, planInput, { createdById: null, createdVia: "LIFF" });
  if (!result.ok) return result;

  await createInitialPayments(result.id, result.total, plan.depositAmount);

  revalidatePath("/orders/bath");
  revalidatePath("/orders/other");
  revalidatePath("/boarding");
  return { ok: true, id: result.id, message: "สร้างการจองเรียบร้อย" };
}

/** รายการออเดอร์ทั้งหมดของลูกค้าคนนี้ (จาก lineUserId ที่ยืนยันแล้วเท่านั้น) — ใช้แสดงหน้า "การจองของฉัน"
 * ให้ลูกค้าย้อนกลับมาดูประวัติ/ไปจ่ายส่วนที่ค้างเองได้ โดยไม่ต้องรอพนักงานส่งลิงก์ให้ใหม่ทุกครั้ง */
export async function liffListOrders(idToken: string) {
  const identity = await verifyLiffIdToken(idToken);
  if (!identity) {
    return { ok: false as const, error: "เซสชันหมดอายุ กรุณาเปิดลิงก์นี้ใหม่จาก LINE", code: "LIFF_AUTH_EXPIRED" as const };
  }

  const customer = await prisma.customer.findUnique({ where: { lineUserId: identity.userId } });
  if (!customer) {
    return { ok: false as const, error: "ไม่พบข้อมูลลูกค้า กรุณาลงทะเบียนก่อน", notRegistered: true as const };
  }

  const orders = await prisma.order.findMany({
    where: { customerId: customer.id },
    orderBy: { createdAt: "desc" },
    take: 50,
    select: {
      id: true,
      code: true,
      createdAt: true,
      status: true,
      total: true,
      pet: { select: { name: true } },
      payments: { select: { status: true, amount: true } },
      extraCharges: { select: { amount: true } },
    },
  });

  return {
    ok: true as const,
    orders: orders.map((o) => {
      const verifiedSum = o.payments
        .filter((p) => p.status === "VERIFIED")
        .reduce((sum, p) => sum + p.amount, 0);
      const amountOwed = o.total + o.extraCharges.reduce((sum, c) => sum + c.amount, 0);
      return {
        id: o.id,
        code: o.code,
        createdAt: o.createdAt.toISOString(),
        status: o.status,
        petName: o.pet?.name ?? null,
        total: amountOwed,
        remainingAmount: Math.max(0, amountOwed - verifiedSum),
        hasSubmittedSlip: o.payments.some((p) => p.status === "SUBMITTED"),
      };
    }),
  };
}

/** สถานะการจ่ายเงิน/QR ของออเดอร์ตัวเอง — เช็คความเป็นเจ้าของก่อนทุกครั้ง ป้องกันเดาเลขออเดอร์คนอื่นมาดู
 * ตั้งใจไม่แยกข้อความ error ระหว่าง "ไม่พบออเดอร์" กับ "ไม่ใช่ของคุณ" เพื่อกันการเดาว่าเลขไหนมีอยู่จริง */
export async function getLiffOrderPaymentStatus(idToken: string, orderId: string) {
  const identity = await verifyLiffIdToken(idToken);
  if (!identity) {
    return { ok: false as const, error: "เซสชันหมดอายุ กรุณาเปิดลิงก์นี้ใหม่จาก LINE", code: "LIFF_AUTH_EXPIRED" as const };
  }

  const order = await prisma.order.findUnique({
    where: { id: orderId },
    select: {
      code: true,
      createdAt: true,
      status: true,
      total: true,
      note: true,
      appointmentAt: true,
      checkInAt: true,
      checkOutAt: true,
      nights: true,
      holidaySurcharge: true,
      holidayLabel: true,
      customer: { select: { lineUserId: true, name: true } },
      pet: { select: { name: true, species: true, allergies: true } },
      room: { select: { name: true, category: { select: { name: true } } } },
      items: {
        orderBy: { createdAt: "asc" },
        select: { id: true, name: true, quantity: true, unitPrice: true, subtotal: true },
      },
      extraCharges: {
        orderBy: { createdAt: "desc" },
        select: { id: true, description: true, amount: true },
      },
      payments: {
        orderBy: { createdAt: "asc" },
        select: {
          id: true,
          purpose: true,
          amount: true,
          status: true,
          qrPayload: true,
          expiresAt: true,
          bankAccount: { select: { bankName: true, accountName: true, accountNumber: true } },
        },
      },
    },
  });
  if (!order || order.customer?.lineUserId !== identity.userId) {
    return { ok: false as const, error: "ไม่พบการจองนี้" };
  }

  return {
    ok: true as const,
    orderCode: order.code,
    createdAt: order.createdAt.toISOString(),
    status: order.status,
    total: order.total,
    note: order.note,
    appointmentAt: order.appointmentAt?.toISOString() ?? null,
    checkInAt: order.checkInAt?.toISOString() ?? null,
    checkOutAt: order.checkOutAt?.toISOString() ?? null,
    nights: order.nights,
    holidaySurcharge: order.holidaySurcharge,
    holidayLabel: order.holidayLabel,
    ownerName: order.customer?.name ?? "",
    pet: order.pet,
    room: order.room,
    items: order.items,
    extraCharges: order.extraCharges,
    payments: order.payments.map((p) => ({
      id: p.id,
      purpose: p.purpose,
      amount: p.amount,
      status: p.status,
      qrPayload: p.qrPayload,
      expiresAt: p.expiresAt?.toISOString() ?? null,
      bankAccount: p.bankAccount,
    })),
  };
}

/** ลูกค้าแนบรูปสลิปโอนเงินเข้ากับรายการชำระเงินของตัวเอง — แค่บันทึกรูป+เปลี่ยนสถานะเป็น "รอตรวจสอบ"
 * (SUBMITTED) เท่านั้น ไม่ได้ยืนยันอัตโนมัติ พนักงานยังต้องกดตรวจ/ยืนยันในระบบหลังบ้านเหมือนเดิม */
export async function liffSubmitPaymentSlip(
  idToken: string,
  paymentId: string,
  slipUrl: string
): Promise<ActionResult> {
  const identity = await verifyLiffIdToken(idToken);
  if (!identity) {
    return { ok: false, error: "เซสชัน LINE หมดอายุ กรุณาเปิดหน้านี้ใหม่จากแอป LINE", code: "LIFF_AUTH_EXPIRED" };
  }
  if (!slipUrl) return { ok: false, error: "กรุณาแนบรูปสลิป" };

  const payment = await prisma.payment.findUnique({
    where: { id: paymentId },
    include: { order: { select: { id: true, customer: { select: { lineUserId: true } } } } },
  });
  if (!payment || payment.order.customer?.lineUserId !== identity.userId) {
    return { ok: false, error: "ไม่พบรายการชำระเงินนี้" };
  }
  if (payment.status === "VERIFIED") {
    return { ok: false, error: "รายการนี้ยืนยันแล้ว ไม่ต้องส่งสลิปซ้ำ" };
  }

  await prisma.payment.update({
    where: { id: paymentId },
    data: { slipUrl, status: "SUBMITTED", submittedAt: new Date() },
  });
  revalidatePath(`/orders/${payment.order.id}`);
  return { ok: true, message: "ส่งสลิปเรียบร้อย รอร้านตรวจสอบ" };
}
