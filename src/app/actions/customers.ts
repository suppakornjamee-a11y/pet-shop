"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth-helpers";

const petSchema = z.object({
  name: z.string().min(1, "กรุณากรอกชื่อสัตว์เลี้ยง"),
  species: z.enum(["DOG", "CAT"]),
  breed: z.string().optional(),
  gender: z.enum(["MALE", "FEMALE", "UNKNOWN"]).default("UNKNOWN"),
  birthDate: z.string().optional(),
  weightKg: z.coerce.number().optional(),
  color: z.string().optional(),
  personality: z.string().optional(),
  aggressiveNotes: z.string().optional(),
  allergies: z.string().optional(),
  vaccine5in1Date: z.string().optional(),
  rabiesVaccineDate: z.string().optional(),
  lastFleaTickDate: z.string().optional(),
  fleaTickMedicine: z.string().optional(),
  foodNote: z.string().optional(),
  medicationNote: z.string().optional(),
  neutered: z.coerce.boolean().default(false),
  note: z.string().optional(),
  photoUrls: z.array(z.string()).default([]),
  vaccinePhotoUrls: z.array(z.string()).default([]),
  vaccineComplete: z.coerce.boolean().default(false),
});

// ใช้เฉพาะหน้าลงทะเบียนสัตว์เลี้ยง (RegisterForm) — บังคับกรอกครบทุกฟิลด์ ยกเว้นหมายเหตุ
const petRegisterSchema = petSchema.extend({
  breed: z.string().min(1, "กรุณากรอกพันธุ์"),
  birthDate: z.string().min(1, "กรุณาเลือกวันเกิดสัตว์เลี้ยง"),
  weightKg: z.coerce.number().gt(0, "กรุณากรอกน้ำหนัก"),
  color: z.string().min(1, "กรุณากรอกสี"),
  personality: z.string().min(1, "กรุณากรอกนิสัย"),
  aggressiveNotes: z.string().min(1, "กรุณากรอกข้อควรระวังด้านความก้าวร้าว"),
  allergies: z.string().min(1, "กรุณากรอกอาการแพ้หรือปัญหาสุขภาพ"),
  vaccine5in1Date: z.string().min(1, "กรุณาเลือกวันที่ฉีดวัคซีนรวม 5/6 โรคล่าสุด"),
  rabiesVaccineDate: z.string().min(1, "กรุณาเลือกวันที่ฉีดวัคซีนพิษสุนัขบ้าล่าสุด"),
  lastFleaTickDate: z.string().min(1, "กรุณาเลือกวันที่กำจัดเห็บหมัดครั้งล่าสุด"),
  fleaTickMedicine: z.string().min(1, "กรุณากรอกชื่อของยากำจัดเห็บหมัดที่ใช้"),
  foodNote: z.string().min(1, "กรุณากรอกรายละเอียดการให้อาหาร"),
  medicationNote: z.string().min(1, "กรุณากรอกรายละเอียดการให้ยา"),
  photoUrls: z.array(z.string()).min(1, "กรุณาแนบรูปสัตว์เลี้ยงอย่างน้อย 1 รูป"),
  vaccinePhotoUrls: z.array(z.string()).min(1, "กรุณาแนบรูปสมุดวัคซีนอย่างน้อย 1 รูป"),
});

function petCreateData(p: z.infer<typeof petSchema>) {
  return {
    name: p.name,
    species: p.species,
    gender: p.gender,
    breed: p.breed || null,
    color: p.color || null,
    weightKg: p.weightKg ?? null,
    birthDate: p.birthDate ? new Date(p.birthDate) : null,
    allergies: p.allergies || null,
    note: p.note || null,
    personality: p.personality || null,
    aggressiveNotes: p.aggressiveNotes || null,
    foodNote: p.foodNote || null,
    medicationNote: p.medicationNote || null,
    neutered: p.neutered,
    photoUrls: p.photoUrls,
    vaccinePhotoUrls: p.vaccinePhotoUrls,
    vaccineComplete: p.vaccineComplete,
    vaccine5in1At: p.vaccine5in1Date ? new Date(p.vaccine5in1Date) : null,
    rabiesVaccineAt: p.rabiesVaccineDate ? new Date(p.rabiesVaccineDate) : null,
    lastFleaTickAt: p.lastFleaTickDate ? new Date(p.lastFleaTickDate) : null,
    fleaTickMedicine: p.fleaTickMedicine || null,
  };
}

const customerSchema = z.object({
  name: z.string().min(1, "กรุณากรอกชื่อเจ้าของ"),
  nickname: z.string().optional(),
  phone: z.string().min(6, "กรุณากรอกเบอร์โทร"),
  email: z.string().optional(),
  lineId: z.string().optional(),
  address: z.string().optional(),
  petInstagram: z.string().optional(),
  preferredLanguage: z.enum(["TH", "EN"]).default("TH"),
  note: z.string().optional(),
});

export type ActionResult =
  | { ok: true; id?: string; message?: string }
  | { ok: false; error: string };

export async function createCustomerWithPets(input: {
  customer: unknown;
  pets: unknown;
}): Promise<ActionResult> {
  await requireUser();

  const customer = customerSchema.safeParse(input.customer);
  if (!customer.success) {
    return { ok: false, error: customer.error.issues[0].message };
  }

  const petsParsed = z
    .array(petRegisterSchema)
    .min(1, "ต้องมีสัตว์เลี้ยงอย่างน้อย 1 ตัว")
    .safeParse(input.pets);
  if (!petsParsed.success) {
    return { ok: false, error: petsParsed.error.issues[0].message };
  }

  const created = await prisma.customer.create({
    data: {
      ...customer.data,
      pets: {
        create: petsParsed.data.map(petCreateData),
      },
    },
  });

  revalidatePath("/customers");
  return { ok: true, id: created.id, message: "บันทึกข้อมูลลูกค้าเรียบร้อย" };
}

const petWithOptionalIdSchema = petRegisterSchema.extend({ id: z.string().optional() });

/** แก้ไขข้อมูลเจ้าของ + สัตว์เลี้ยงทั้งหมดพร้อมกัน (ใช้หน้าเดียวกับลงทะเบียน) */
export async function updateCustomerWithPets(input: {
  customerId: string;
  customer: unknown;
  pets: unknown;
}): Promise<ActionResult> {
  await requireUser();

  const customer = customerSchema.safeParse(input.customer);
  if (!customer.success) {
    return { ok: false, error: customer.error.issues[0].message };
  }

  const petsParsed = z
    .array(petWithOptionalIdSchema)
    .min(1, "ต้องมีสัตว์เลี้ยงอย่างน้อย 1 ตัว")
    .safeParse(input.pets);
  if (!petsParsed.success) {
    return { ok: false, error: petsParsed.error.issues[0].message };
  }

  await prisma.$transaction(async (tx) => {
    await tx.customer.update({ where: { id: input.customerId }, data: customer.data });

    for (const p of petsParsed.data) {
      if (p.id) {
        await tx.pet.update({ where: { id: p.id }, data: petCreateData(p) });
      } else {
        await tx.pet.create({ data: { customerId: input.customerId, ...petCreateData(p) } });
      }
    }
  });

  revalidatePath(`/customers/${input.customerId}`);
  revalidatePath("/customers");
  return { ok: true, id: input.customerId, message: "บันทึกข้อมูลเรียบร้อย" };
}

export async function addPet(input: {
  customerId: string;
  pet: unknown;
}): Promise<ActionResult> {
  await requireUser();
  const pet = petSchema.safeParse(input.pet);
  if (!pet.success) return { ok: false, error: pet.error.issues[0].message };

  await prisma.pet.create({
    data: { customerId: input.customerId, ...petCreateData(pet.data) },
  });

  revalidatePath(`/customers/${input.customerId}`);
  return { ok: true, message: "เพิ่มสัตว์เลี้ยงเรียบร้อย" };
}

export async function updateCustomer(input: {
  id: string;
  data: unknown;
}): Promise<ActionResult> {
  await requireUser();
  const parsed = customerSchema.safeParse(input.data);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message };

  await prisma.customer.update({
    where: { id: input.id },
    data: {
      name: parsed.data.name,
      nickname: parsed.data.nickname || null,
      phone: parsed.data.phone,
      email: parsed.data.email || null,
      address: parsed.data.address || null,
      lineId: parsed.data.lineId || null,
      petInstagram: parsed.data.petInstagram || null,
      preferredLanguage: parsed.data.preferredLanguage,
      note: parsed.data.note || null,
    },
  });

  revalidatePath(`/customers/${input.id}`);
  return { ok: true, message: "อัปเดตข้อมูลลูกค้าเรียบร้อย" };
}

export async function updatePet(input: {
  id: string;
  customerId: string;
  pet: unknown;
}): Promise<ActionResult> {
  await requireUser();
  const parsed = petSchema.safeParse(input.pet);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message };

  await prisma.pet.update({
    where: { id: input.id },
    data: petCreateData(parsed.data),
  });

  revalidatePath(`/customers/${input.customerId}`);
  return { ok: true, message: "อัปเดตข้อมูลสัตว์เลี้ยงเรียบร้อย" };
}

export async function searchCustomers(query: string) {
  await requireUser();
  const q = query.trim();
  return prisma.customer.findMany({
    where: q
      ? {
          OR: [
            { name: { contains: q, mode: "insensitive" } },
            { phone: { contains: q } },
          ],
        }
      : undefined,
    include: { pets: true },
    orderBy: { createdAt: "desc" },
    take: 20,
  });
}
