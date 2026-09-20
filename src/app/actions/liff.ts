"use server";

// ไฟล์นี้เรียกได้โดยไม่ต้องล็อกอิน (เข้าถึงผ่าน LINE LIFF mini-app เท่านั้น) — ห้าม import
// requireUser/requireStaffUser มาใช้ที่นี่ ทุกฟังก์ชันต้องยืนยันตัวตนด้วย verifyLiffIdToken() ก่อนเสมอ
//
// ขอบเขตที่ลูกค้าทำเองได้: "สร้างการจองใหม่" (ทีละรายการ หรือส่งทั้งตะกร้าเป็นคำขอจอง),
// "เลือกวันเวลาใหม่ให้คำขอของตัวเองเมื่อแอดมินแจ้งคิวไม่ว่าง" และ "ยกเลิกการจองของตัวเองก่อนร้านยืนยันเงิน"
// เท่านั้น (เดิม v1 อนุญาตแค่สร้างใหม่ — เปิดเพิ่มตามที่ร้านสั่ง) ห้ามเพิ่มฟังก์ชัน
// ยืนยัน/ปฏิเสธการชำระเงิน หรือเปลี่ยนสถานะออเดอร์เป็นอย่างอื่นเด็ดขาด — ของพวกนั้นอยู่ใน
// actions/orders.ts ที่บังคับล็อกอินพนักงานเท่านั้น (ดูแผนงาน lexical-coalescing-crystal.md)
//
// ข้อยกเว้นเดียวที่ไม่ต้องยืนยันตัวตน: getFleaTickCatalog() — อ่านรายชื่อยาเห็บหมัดสาธารณะ (ชื่อ/สูตร/ชนิดสัตว์)
// ไว้ช่วยลูกค้าจับคู่ชื่อยาในฟอร์ม ไม่มีข้อมูลลูกค้า และเขียนอะไรไม่ได้

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { verifyLiffIdToken } from "@/lib/line";
import { customerSchema, petRegisterSchema } from "@/lib/customer-schema";
import { petCreateInput, petUpdateInput } from "@/lib/pet-write";
import { buildOrderPlan, persistOrder, type OrderFormData } from "@/lib/order-plan";
import {
  amountDueNow,
  cartItemSchema,
  createBookingRequest,
  syncBookingRequestForOrder,
  syncBookingRequestStatus,
} from "@/lib/booking-request";
import { quickPetSchema, quickPetWriteData } from "@/lib/pet-quick";
import { createInitialPayments } from "./orders";
import { isSlotAvailable } from "@/lib/booking";
import { isRoomAvailable } from "@/lib/room-availability";
import { QUEUE_REJECT_LOG_PREFIX } from "@/lib/order-log";
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
        pets: { create: await Promise.all(petsParsed.data.map((p) => petCreateInput(prisma, p))) },
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
      fleaTickProductId: p.fleaTickProductId,
      fleaTickEvidenceUrls: p.fleaTickEvidenceUrls,
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
        await tx.pet.update({ where: { id: p.id }, data: await petUpdateInput(tx, p.id, p) });
      } else {
        await tx.pet.create({ data: { customerId: existing.id, ...(await petCreateInput(tx, p)) } });
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

  // ลูกค้าจองเองต้องให้พนักงานยืนยันคิวก่อนถึงจะจ่ายเงินได้ — คิวส่วนกลาง/ห้องพักมีเงื่อนไขหน้างาน
  // (ช่างว่างจริงไหม สัตว์เข้ากับตัวอื่นได้ไหม) ที่ระบบเช็คแทนไม่ได้ทั้งหมด
  await prisma.order.update({ where: { id: result.id }, data: { status: "PENDING_APPROVAL" } });

  // สร้างรายการชำระเงินไว้เลย แต่ยังไม่ออก QR — ตอนอนุมัติค่อยปล่อยให้จ่าย
  await createInitialPayments(result.id, result.total, plan.depositAmount);

  revalidatePath("/orders/bath");
  revalidatePath("/orders/other");
  revalidatePath("/boarding");
  return { ok: true, id: result.id, message: "ส่งคำขอจองแล้ว รอเจ้าหน้าที่ยืนยันคิว" };
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
      // เหตุผลที่พนักงานปฏิเสธคิว — เก็บไว้ใน activity log ไม่มีคอลัมน์แยก เอาเฉพาะรายการล่าสุดที่ขึ้นต้นด้วย prefix
      activityLogs: {
        where: { action: { startsWith: QUEUE_REJECT_LOG_PREFIX } },
        orderBy: { createdAt: "desc" },
        take: 1,
        select: { action: true },
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
          rejectReason: true,
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
    queueRejectReason: order.activityLogs[0]?.action.slice(QUEUE_REJECT_LOG_PREFIX.length) ?? null,
    payments: order.payments.map((p) => ({
      id: p.id,
      purpose: p.purpose,
      amount: p.amount,
      status: p.status,
      qrPayload: p.qrPayload,
      expiresAt: p.expiresAt?.toISOString() ?? null,
      rejectReason: p.rejectReason,
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
    include: {
      order: { select: { id: true, status: true, customer: { select: { lineUserId: true } } } },
    },
  });
  if (!payment || payment.order.customer?.lineUserId !== identity.userId) {
    return { ok: false, error: "ไม่พบรายการชำระเงินนี้" };
  }
  if (payment.status === "VERIFIED") {
    return { ok: false, error: "รายการนี้ยืนยันแล้ว ไม่ต้องส่งสลิปซ้ำ" };
  }
  // กันเคสที่ลูกค้ายังค้างหน้าเก่าไว้แล้วส่งสลิปมาก่อนพนักงานยืนยันคิว
  if (payment.order.status === "PENDING_APPROVAL") {
    return { ok: false, error: "การจองนี้ยังรอเจ้าหน้าที่ยืนยันคิว กรุณารอลิงก์ชำระเงินทาง LINE" };
  }

  await prisma.payment.update({
    where: { id: paymentId },
    data: { slipUrl, status: "SUBMITTED", submittedAt: new Date() },
  });

  await syncBookingRequestForOrder(payment.order.id);
  revalidatePath(`/orders/${payment.order.id}`);
  return { ok: true, message: "ส่งสลิปเรียบร้อย รอร้านตรวจสอบ" };
}

/**
 * ลูกค้ายกเลิกการจองของตัวเอง — ทำได้เฉพาะตอนที่ยังเป็น "รอเช็คคิว" เท่านั้น
 *
 * จงใจไม่ให้ยกเลิกหลังพนักงานยืนยันคิวแล้ว เพราะจากจุดนั้นไปมีทั้งเงินมัดจำและคิวที่ร้านกันไว้
 * ให้แล้ว ต้องคุยกับร้านเป็นรายกรณี (กฎการคืนเงิน/แจ้งล่วงหน้ายังไม่มีในระบบ) — ปล่อยให้กดเองไม่ได้
 */
export async function liffCancelOrder(
  idToken: string,
  orderId: string,
  reason?: string
): Promise<ActionResult> {
  const identity = await verifyLiffIdToken(idToken);
  if (!identity) {
    return { ok: false, error: "เซสชัน LINE หมดอายุ กรุณาเปิดหน้านี้ใหม่จากแอป LINE", code: "LIFF_AUTH_EXPIRED" };
  }

  const order = await prisma.order.findUnique({
    where: { id: orderId },
    select: {
      id: true,
      code: true,
      status: true,
      customer: { select: { lineUserId: true } },
      payments: { select: { status: true } },
    },
  });
  // ตอบข้อความเดียวกันทั้งกรณีไม่มีออเดอร์และกรณีเป็นของคนอื่น จะได้ไม่กลายเป็นเครื่องมือเดาว่า
  // เลขออเดอร์ไหนมีอยู่จริงบ้าง
  if (!order || order.customer?.lineUserId !== identity.userId) {
    return { ok: false, error: "ไม่พบการจองนี้" };
  }
  if (order.status === "CANCELLED") {
    return { ok: false, error: "การจองนี้ถูกยกเลิกไปแล้ว" };
  }
  // เส้นแบ่งคือ "จ่ายเงินมาแล้วหรือยัง" ไม่ใช่ "ผ่านการเช็คคิวหรือยัง" — ตราบใดที่ยังไม่มีเงินเข้า
  // ลูกค้ายกเลิกเองได้ ไม่ต้องโทรหาร้าน พอมีเงินเข้าแล้วต้องคุยเรื่องคืนเงินซึ่งระบบยังไม่มีกฎรองรับ
  if (order.payments.some((p) => p.status === "VERIFIED")) {
    return { ok: false, error: "การจองนี้ชำระเงินแล้ว กรุณาติดต่อร้านเพื่อยกเลิกและคืนเงิน" };
  }
  if (order.status !== "PENDING_APPROVAL" && order.status !== "PENDING_PAYMENT") {
    return { ok: false, error: "การจองนี้เริ่มดำเนินการแล้ว กรุณาติดต่อร้าน" };
  }

  const note = (reason ?? "").trim();
  await prisma.$transaction([
    prisma.order.update({ where: { id: orderId }, data: { status: "CANCELLED" } }),
    prisma.orderActivityLog.create({
      data: {
        orderId,
        action: note
          ? `ลูกค้ายกเลิกการจองเองผ่าน LINE: ${note}`
          : "ลูกค้ายกเลิกการจองเองผ่าน LINE",
      },
    }),
  ]);

  await syncBookingRequestForOrder(orderId);

  // ล้างหน้าฝั่งพนักงานให้ตรงกับความจริงทันที รวมถึงกระดิ่งแจ้งเตือนที่นับคิวรอยืนยันอยู่
  for (const p of ["/orders/" + orderId, "/orders/bath", "/orders/other", "/boarding", "/calendar", "/calendar-other", "/"]) {
    revalidatePath(p);
  }
  return { ok: true, message: "ยกเลิกการจองเรียบร้อย" };
}

/**
 * รายชื่อยาเห็บหมัดที่เปิดใช้งาน สำหรับช่วยจับคู่ชื่อที่ลูกค้าพิมพ์ในฟอร์มข้อมูลสัตว์เลี้ยง
 * ใช้ทั้งฝั่งลูกค้า (LIFF) และฝั่งพนักงาน — ข้อมูลสาธารณะ ไม่ต้องยืนยันตัวตน
 * ระยะคุ้มครองส่งไปด้วยเพื่อคำนวณสถานะบนหน้าจอ (ดู lib/flea-tick — REQUIRE_VERIFIED_PRODUCTS)
 */
export async function getFleaTickCatalog() {
  return prisma.fleaTickProduct.findMany({
    where: { active: true },
    orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
    select: {
      id: true,
      name: true,
      formula: true,
      aliases: true,
      species: true,
      form: true,
      tickValue: true,
      tickUnit: true,
      fleaValue: true,
      fleaUnit: true,
      bathNote: true,
      status: true,
    },
  });
}

/* ---------- คำขอจอง (ตะกร้า) ---------- */

const submitRequestSchema = z.object({
  items: z.array(cartItemSchema).min(1, "กรุณาเพิ่มรายการจองอย่างน้อย 1 รายการ").max(10, "เพิ่มได้ไม่เกิน 10 รายการต่อคำขอ"),
});

/** ลูกค้าส่งคำขอจองทั้งตะกร้า — ทุกรายการรอแอดมินตรวจสอบคิว ยังไม่ออก QR จนกว่าจะอนุมัติ */
export async function liffSubmitBookingRequest(idToken: string, input: unknown) {
  const identity = await verifyLiffIdToken(idToken);
  if (!identity) {
    return { ok: false as const, error: "เซสชัน LINE หมดอายุ กรุณาเปิดหน้านี้ใหม่จากแอป LINE", code: "LIFF_AUTH_EXPIRED" as const };
  }
  const customer = await prisma.customer.findUnique({ where: { lineUserId: identity.userId } });
  if (!customer) return { ok: false as const, error: "ไม่พบข้อมูลลูกค้า กรุณากรอกข้อมูลก่อน" };

  const parsed = submitRequestSchema.safeParse(input);
  if (!parsed.success) return { ok: false as const, error: parsed.error.issues[0].message };

  const result = await createBookingRequest(customer.id, parsed.data.items);
  if (!result.ok) return { ok: false as const, error: result.error, itemIndex: result.itemIndex };

  revalidatePath("/orders/bath");
  revalidatePath("/orders/other");
  revalidatePath("/boarding");
  return { ok: true as const, id: result.id, code: result.code };
}

/** รายละเอียดคำขอจองของตัวเอง — สถานะ รายการ ยอด และ QR ล่าสุด (เช็คว่าเป็นของลูกค้าคนนี้จริง) */
export async function liffGetBookingRequest(idToken: string, requestId: string) {
  const identity = await verifyLiffIdToken(idToken);
  if (!identity) {
    return { ok: false as const, error: "เซสชันหมดอายุ กรุณาเปิดลิงก์นี้ใหม่จาก LINE", code: "LIFF_AUTH_EXPIRED" as const };
  }
  const req = await prisma.bookingRequest.findUnique({
    where: { id: requestId },
    include: {
      customer: { select: { lineUserId: true } },
      orders: {
        orderBy: { createdAt: "asc" },
        select: {
          id: true,
          code: true,
          status: true,
          total: true,
          depositAmount: true,
          appointmentAt: true,
          queueType: true,
          checkInAt: true,
          checkOutAt: true,
          groomingStyleNote: true,
          pet: { select: { id: true, name: true, species: true } },
          room: { select: { name: true, category: { select: { name: true } } } },
          items: { orderBy: { createdAt: "asc" }, select: { name: true, subtotal: true, itemType: true, refId: true } },
          payments: { orderBy: { createdAt: "desc" }, select: { status: true, amount: true } },
          activityLogs: {
            where: { action: { startsWith: QUEUE_REJECT_LOG_PREFIX } },
            orderBy: { createdAt: "desc" },
            take: 1,
            select: { action: true },
          },
        },
      },
    },
  });
  if (!req || req.customer.lineUserId !== identity.userId) {
    return { ok: false as const, error: "ไม่พบคำขอจองนี้" };
  }
  const iso = (d: Date | null) => d?.toISOString() ?? null;
  return {
    ok: true as const,
    id: req.id,
    code: req.code,
    status: req.status,
    rescheduleReason: req.rescheduleReason,
    orders: req.orders.map(({ payments, activityLogs, ...o }) => ({
      ...o,
      appointmentAt: iso(o.appointmentAt),
      checkInAt: iso(o.checkInAt),
      checkOutAt: iso(o.checkOutAt),
      dueNow: amountDueNow(o),
      // payments เรียงใหม่สุดก่อน — ตัวแรกคือรายการชำระล่าสุด
      paymentStatus: payments[0]?.status ?? null,
      paid: payments.filter((p) => p.status === "VERIFIED").reduce((sum, p) => sum + p.amount, 0),
      queueRejectReason: activityLogs[0]?.action.slice(QUEUE_REJECT_LOG_PREFIX.length) ?? null,
    })),
  };
}

const rescheduleSchema = z.object({
  items: z
    .array(
      z.object({
        orderId: z.string().min(1),
        appointmentDate: z.string().optional(),
        appointmentTime: z.string().optional(),
        checkInDate: z.string().optional(),
        checkInTime: z.string().optional(),
        checkOutDate: z.string().optional(),
        checkOutTime: z.string().optional(),
      })
    )
    .min(1),
});

/**
 * คิวไม่ว่าง → ลูกค้าเลือกวันเวลาใหม่ให้รายการเดิม (สัตว์เลี้ยงและบริการคงเดิมทั้งหมด) แล้วส่งกลับให้แอดมินตรวจอีกครั้ง
 * ส่งมาทีละรายการหรือหลายรายการก็ได้ — เช็คทุกรายการที่ส่งมาผ่านก่อน แล้วค่อยบันทึกพร้อมกัน
 */
export async function liffRescheduleBookingRequest(idToken: string, requestId: string, input: unknown) {
  const identity = await verifyLiffIdToken(idToken);
  if (!identity) {
    return { ok: false as const, error: "เซสชัน LINE หมดอายุ กรุณาเปิดหน้านี้ใหม่จากแอป LINE", code: "LIFF_AUTH_EXPIRED" as const };
  }
  const parsed = rescheduleSchema.safeParse(input);
  if (!parsed.success) return { ok: false as const, error: parsed.error.issues[0].message };

  const req = await prisma.bookingRequest.findUnique({
    where: { id: requestId },
    include: {
      customer: { select: { id: true, lineUserId: true } },
      orders: { where: { status: "RESCHEDULE_REQUIRED" }, include: { items: true, pet: { select: { vaccineComplete: true } } } },
    },
  });
  if (!req || req.customer.lineUserId !== identity.userId) return { ok: false as const, error: "ไม่พบคำขอจองนี้" };
  if (req.orders.length === 0) return { ok: false as const, error: "คำขอนี้ไม่มีรายการที่รอเลือกวันเวลาใหม่" };

  const changes = new Map(parsed.data.items.map((i) => [i.orderId, i]));
  const plans: { orderId: string; plan: Extract<Awaited<ReturnType<typeof buildOrderPlan>>, { ok: true }> }[] = [];
  // แอดมินแจ้งคิวไม่ว่างทีละรายการ ลูกค้าจึงส่งวันเวลาใหม่มาเฉพาะรายการที่แก้ก็ได้
  const targets = req.orders.filter((o) => changes.has(o.id));
  if (targets.length === 0) return { ok: false as const, error: "ไม่พบรายการที่รอเลือกวันเวลาใหม่" };
  for (const o of targets) {
    const c = changes.get(o.id)!;
    const boarding = !!o.roomId;
    const planInput: OrderFormData = {
      customerId: req.customer.id,
      petId: o.petId,
      roomId: o.roomId,
      checkInDate: boarding ? c.checkInDate : undefined,
      checkInTime: boarding ? c.checkInTime : undefined,
      checkOutDate: boarding ? c.checkOutDate : undefined,
      checkOutTime: boarding ? c.checkOutTime : undefined,
      nannyType: o.nannyType,
      cctvRequested: o.cctvRequested,
      depositAmount: 0,
      vaccineComplete: o.pet?.vaccineComplete ?? false,
      note: o.note ?? undefined,
      serviceIds: o.items.filter((it) => it.itemType === "SERVICE" && it.refId).map((it) => it.refId!),
      productLines: [],
      appointmentDate: boarding ? undefined : c.appointmentDate,
      appointmentTime: boarding ? undefined : c.appointmentTime,
      queueType: o.queueType === "OTHER" ? "OTHER" : "BATH",
    };
    const plan = await buildOrderPlan(planInput, o.id);
    if (!plan.ok) return { ok: false as const, error: plan.error, orderId: o.id };
    plans.push({ orderId: o.id, plan });
  }

  await prisma.$transaction(async (tx) => {
    for (const { orderId, plan } of plans) {
      await tx.orderItem.deleteMany({ where: { orderId } });
      await tx.order.update({
        where: { id: orderId },
        data: {
          status: "PENDING_APPROVAL",
          appointmentAt: plan.appointmentAt,
          checkInAt: plan.checkInAt,
          checkOutAt: plan.checkOutAt,
          nights: plan.nights,
          depositAmount: plan.depositAmount,
          holidaySurcharge: plan.holidaySurcharge,
          holidayLabel: plan.holidayLabel,
          subtotal: plan.subtotal,
          total: plan.subtotal + plan.holidaySurcharge,
          items: { create: plan.items },
        },
      });
      await tx.orderActivityLog.create({ data: { orderId, action: "ลูกค้าเลือกวันเวลาใหม่ ส่งให้ตรวจสอบคิวอีกครั้ง" } });
    }
    await tx.bookingRequest.update({ where: { id: requestId }, data: { submittedAt: new Date() } });
  });
  await syncBookingRequestStatus(requestId);

  revalidatePath("/orders/bath");
  revalidatePath("/orders/other");
  revalidatePath("/boarding");
  return { ok: true as const };
}

/* ---------- หน้าจองแบบใหม่: ข้อมูลตั้งต้น + ฟอร์มสั้น ---------- */

/**
 * ข้อมูลตั้งต้นของหน้าจอง — ยังไม่เคยมีข้อมูลก็เปิดหน้าจองได้เลย (ไม่บังคับไปหน้าลงทะเบียนก่อน)
 * มีข้อมูลแล้ว: ส่งข้อมูลสุขภาพ/ข้อควรระวัง/ยาเห็บหมัดของสัตว์แต่ละตัว ให้ลูกค้าตรวจและแก้ก่อนจอง
 */
export async function liffGetBookingContext(idToken: string) {
  const identity = await verifyLiffIdToken(idToken);
  if (!identity) {
    return { ok: false as const, error: "เซสชัน LINE หมดอายุ กรุณาเปิดหน้านี้ใหม่จากแอป LINE", code: "LIFF_AUTH_EXPIRED" as const };
  }
  const customer = await prisma.customer.findUnique({
    where: { lineUserId: identity.userId },
    select: {
      id: true,
      name: true,
      phone: true,
      petInstagram: true,
      pets: {
        orderBy: { createdAt: "asc" },
        select: {
          id: true,
          name: true,
          species: true,
          breed: true,
          birthDate: true,
          weightKg: true,
          allergies: true,
          groomingCautions: true,
          hasChronicDisease: true,
          chronicDiseaseNote: true,
          fleaTickMedicine: true,
          fleaTickProductId: true,
          fleaTickSource: true,
          lastFleaTickAt: true,
        },
      },
    },
  });
  if (!customer) return { ok: true as const, linked: false as const, displayName: identity.name ?? null };
  return {
    ok: true as const,
    linked: true as const,
    customer: {
      id: customer.id,
      name: customer.name,
      phone: customer.phone,
      petInstagram: customer.petInstagram,
    },
    pets: customer.pets.map((p) => ({
      ...p,
      birthDate: p.birthDate ? toThaiDateStr(p.birthDate) : "",
      lastFleaTickAt: p.lastFleaTickAt ? toThaiDateStr(p.lastFleaTickAt) : "",
    })),
  };
}

const quickProfileSchema = z.object({
  customer: z
    .object({
      name: z.string().trim().min(1, "กรุณากรอกชื่อ–นามสกุลเจ้าของ"),
      phone: z.string().trim().min(6, "กรุณากรอกเบอร์โทรศัพท์"),
      petInstagram: z.string().trim().optional(),
    })
    .optional(),
  pets: z.array(quickPetSchema).max(10).default([]),
  // สัตว์เลี้ยงที่ลูกค้ายืนยันว่า "ข้อมูลเดิมยังถูกต้อง" — อัปเดตเฉพาะน้ำหนักล่าสุด ข้อมูลอื่นไม่ถูกแตะ
  confirmed: z
    .array(z.object({ id: z.string().min(1), weightKg: z.coerce.number().gt(0, "กรุณากรอกน้ำหนัก") }))
    .max(10)
    .default([]),
});

/**
 * บันทึกฟอร์มสั้น — ยังไม่มีข้อมูล: สร้างลูกค้า (ผูก LINE นี้) + สัตว์เลี้ยง, มีแล้ว: เพิ่ม/แก้สัตว์เลี้ยง
 * หรือยืนยันข้อมูลเดิม (confirmed: อัปเดตแค่น้ำหนักล่าสุด)
 * แก้เฉพาะช่องในฟอร์มสั้น ช่องอื่นของสัตว์เลี้ยงไม่ถูกแตะ และแก้ได้เฉพาะสัตว์ของตัวเอง
 */
export async function liffSaveQuickProfile(idToken: string, input: unknown) {
  const identity = await verifyLiffIdToken(idToken);
  if (!identity) {
    return { ok: false as const, error: "เซสชัน LINE หมดอายุ กรุณาเปิดหน้านี้ใหม่จากแอป LINE", code: "LIFF_AUTH_EXPIRED" as const };
  }
  const parsed = quickProfileSchema.safeParse(input);
  if (!parsed.success) return { ok: false as const, error: parsed.error.issues[0].message };
  const { customer: customerInput, pets, confirmed } = parsed.data;

  let customer = await prisma.customer.findUnique({ where: { lineUserId: identity.userId }, select: { id: true } });
  if (!customer) {
    if (!customerInput) return { ok: false as const, error: "กรุณากรอกข้อมูลเจ้าของ" };
    if (pets.length === 0) return { ok: false as const, error: "กรุณาเพิ่มสัตว์เลี้ยงอย่างน้อย 1 ตัว" };
    customer = await prisma.customer.create({
      data: {
        name: customerInput.name,
        phone: customerInput.phone,
        petInstagram: customerInput.petInstagram || null,
        lineUserId: identity.userId,
        createdVia: "LIFF",
      },
      select: { id: true },
    });
  } else if (customerInput) {
    await prisma.customer.update({
      where: { id: customer.id },
      data: { name: customerInput.name, phone: customerInput.phone, petInstagram: customerInput.petInstagram || null },
    });
  }

  const ownerId = customer.id;
  const editIds = [...pets.map((p) => p.id).filter((id): id is string => !!id), ...confirmed.map((c) => c.id)];
  if (editIds.length > 0) {
    const owned = await prisma.pet.count({ where: { id: { in: editIds }, customerId: ownerId } });
    if (owned !== new Set(editIds).size) return { ok: false as const, error: "ไม่พบสัตว์เลี้ยงนี้ในบัญชีของคุณ" };
  }

  const savedIds = await prisma.$transaction(async (tx) => {
    const ids: string[] = [];
    for (const p of pets) {
      const data = await quickPetWriteData(tx, p);
      if (p.id) {
        await tx.pet.update({ where: { id: p.id }, data });
        ids.push(p.id);
      } else {
        const created = await tx.pet.create({ data: { ...data, customerId: ownerId } });
        ids.push(created.id);
      }
    }
    for (const c of confirmed) {
      await tx.pet.update({ where: { id: c.id }, data: { weightKg: c.weightKg } });
      ids.push(c.id);
    }
    return ids;
  });

  return { ok: true as const, petIds: savedIds };
}
