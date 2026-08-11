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
  allergies: z.string().optional(),
  note: z.string().optional(),
});

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
        create: petsParsed.data.map((p) => ({
          name: p.name,
          species: p.species,
          gender: p.gender,
          breed: p.breed || null,
          color: p.color || null,
          weightKg: p.weightKg ?? null,
          allergies: p.allergies || null,
          note: p.note || null,
        })),
      },
    },
  });

  revalidatePath("/customers");
  return { ok: true, id: created.id, message: "บันทึกข้อมูลลูกค้าเรียบร้อย" };
}

export async function addPet(input: {
  customerId: string;
  pet: unknown;
}): Promise<ActionResult> {
  await requireUser();
  const pet = petSchema.safeParse(input.pet);
  if (!pet.success) return { ok: false, error: pet.error.issues[0].message };

  await prisma.pet.create({
    data: {
      customerId: input.customerId,
      name: pet.data.name,
      species: pet.data.species,
      gender: pet.data.gender,
      breed: pet.data.breed || null,
      color: pet.data.color || null,
      weightKg: pet.data.weightKg ?? null,
      allergies: pet.data.allergies || null,
      note: pet.data.note || null,
    },
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
    data: {
      name: parsed.data.name,
      species: parsed.data.species,
      gender: parsed.data.gender,
      breed: parsed.data.breed || null,
      color: parsed.data.color || null,
      weightKg: parsed.data.weightKg ?? null,
      allergies: parsed.data.allergies || null,
      note: parsed.data.note || null,
    },
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
