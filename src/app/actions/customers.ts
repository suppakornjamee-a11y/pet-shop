"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth-helpers";
import { petSchema, petRegisterSchema, petCreateData, customerSchema } from "@/lib/customer-schema";

export type ActionResult =
  | { ok: true; id?: string; message?: string }
  | { ok: false; error: string; code?: string };

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

export type CustomerFilter = {
  query?: string;
  createdVia?: "ALL" | "STAFF" | "LIFF";
  species?: "ALL" | "DOG" | "CAT";
};

/** รายชื่อลูกค้าสำหรับตารางหน้าประวัติลูกค้า — ค้นหาได้ทั้งชื่อเจ้าของ/ชื่อเล่น/เบอร์โทร/ชื่อสัตว์เลี้ยง
 * แยกจาก searchCustomers ที่ฟอร์มสร้างออเดอร์ใช้อยู่ (คนละรูปแบบข้อมูล จึงไม่แก้ของเดิม) */
export async function listCustomers(filter: CustomerFilter) {
  await requireUser();
  const q = filter.query?.trim() ?? "";
  const conditions = [];

  if (q) {
    conditions.push({
      OR: [
        { name: { contains: q, mode: "insensitive" as const } },
        { nickname: { contains: q, mode: "insensitive" as const } },
        { phone: { contains: q } },
        { pets: { some: { name: { contains: q, mode: "insensitive" as const } } } },
      ],
    });
  }
  if (filter.createdVia && filter.createdVia !== "ALL") {
    conditions.push({ createdVia: filter.createdVia });
  }
  if (filter.species && filter.species !== "ALL") {
    conditions.push({ pets: { some: { species: filter.species } } });
  }

  const customers = await prisma.customer.findMany({
    where: conditions.length > 0 ? { AND: conditions } : undefined,
    select: {
      id: true,
      name: true,
      nickname: true,
      phone: true,
      createdAt: true,
      createdVia: true,
      lineUserId: true,
      pets: { select: { id: true, name: true, species: true }, orderBy: { createdAt: "asc" } },
      // นับ "จำนวนครั้งที่ใช้บริการ" เฉพาะออเดอร์ที่เสร็จสิ้นแล้ว ให้ตรงกับหน้ารายละเอียดลูกค้า
      _count: { select: { orders: { where: { status: "COMPLETED" } } } },
      orders: {
        where: { status: "COMPLETED" },
        orderBy: { createdAt: "desc" },
        take: 1,
        select: { createdAt: true },
      },
    },
    orderBy: { createdAt: "desc" },
    take: 200,
  });

  return customers.map((c) => ({
    id: c.id,
    name: c.name,
    nickname: c.nickname,
    phone: c.phone,
    createdAt: c.createdAt.toISOString(),
    createdVia: c.createdVia,
    lineLinked: c.lineUserId != null,
    pets: c.pets,
    visitCount: c._count.orders,
    lastVisitAt: c.orders[0]?.createdAt.toISOString() ?? null,
  }));
}
