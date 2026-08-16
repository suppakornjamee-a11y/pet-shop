"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth-helpers";

const petSchema = z.object({
  name: z.string().min(1, "กรุณากรอกชื่อสัตว์เลี้ยง"),
  species: z.enum(["DOG", "CAT"]),
  gender: z.enum(["MALE", "FEMALE", "UNKNOWN"]).default("UNKNOWN"),
  breed: z.string().optional(),
  color: z.string().optional(),
  weightKg: z.coerce.number().optional(),
  birthDate: z.string().optional(),
  allergies: z.string().optional(),
  note: z.string().optional(),
  aggressiveNotes: z.string().optional(),
  foodNote: z.string().optional(),
  photoUrls: z.array(z.string()).default([]),
  vaccinePhotoUrls: z.array(z.string()).default([]),
  cctvConsent: z.coerce.boolean().default(false),
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
    aggressiveNotes: p.aggressiveNotes || null,
    foodNote: p.foodNote || null,
    photoUrls: p.photoUrls,
    vaccinePhotoUrls: p.vaccinePhotoUrls,
    cctvConsent: p.cctvConsent,
  };
}

const customerSchema = z.object({
  name: z.string().min(1, "กรุณากรอกชื่อเจ้าของ"),
  phone: z.string().min(6, "กรุณากรอกเบอร์โทร"),
  email: z.string().optional(),
  address: z.string().optional(),
  lineId: z.string().optional(),
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

  const petsParsed = z.array(petSchema).min(1, "ต้องมีสัตว์เลี้ยงอย่างน้อย 1 ตัว").safeParse(input.pets);
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

const petWithOptionalIdSchema = petSchema.extend({ id: z.string().optional() });

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
      phone: parsed.data.phone,
      email: parsed.data.email || null,
      address: parsed.data.address || null,
      lineId: parsed.data.lineId || null,
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
