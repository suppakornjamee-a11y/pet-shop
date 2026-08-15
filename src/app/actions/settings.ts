"use server";

import { z } from "zod";
import bcrypt from "bcryptjs";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireUser, requireAdmin } from "@/lib/auth-helpers";
import type { ActionResult } from "./customers";

/* ---------------- Products / Stock ---------------- */

const productSchema = z.object({
  id: z.string().optional(),
  name: z.string().min(1, "กรุณากรอกชื่อสินค้า"),
  target: z.enum(["PET", "HUMAN"]).default("PET"),
  category: z.string().optional(),
  price: z.coerce.number().int().min(0),
  cost: z.coerce.number().int().min(0).optional(),
  stockQty: z.coerce.number().int().min(0).default(0),
  unit: z.string().default("ชิ้น"),
  active: z.coerce.boolean().default(true),
});

export async function upsertProduct(input: unknown): Promise<ActionResult> {
  const user = await requireUser();
  const parsed = productSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message };
  const { id, ...data } = parsed.data;

  if (id) {
    await prisma.product.update({ where: { id }, data: { ...data, updatedById: user.id } });
  } else {
    await prisma.product.create({
      data: { ...data, createdById: user.id, updatedById: user.id },
    });
  }
  revalidatePath("/settings/stock");
  return { ok: true, message: "บันทึกสินค้าเรียบร้อย" };
}

export async function adjustStock(input: {
  productId: string;
  type: "IN" | "OUT" | "ADJUST";
  quantity: number;
  reason?: string;
}): Promise<ActionResult> {
  const user = await requireUser();
  const { productId, type, quantity, reason } = input;
  if (!quantity || quantity <= 0) return { ok: false, error: "จำนวนต้องมากกว่า 0" };

  await prisma.$transaction(async (tx) => {
    const product = await tx.product.findUnique({ where: { id: productId } });
    if (!product) throw new Error("ไม่พบสินค้า");
    let newQty = product.stockQty;
    if (type === "IN") newQty += quantity;
    else if (type === "OUT") newQty = Math.max(0, newQty - quantity);
    else newQty = quantity; // ADJUST = ตั้งค่าเป็นจำนวนนี้

    await tx.product.update({ where: { id: productId }, data: { stockQty: newQty } });
    await tx.stockMovement.create({
      data: { productId, type, quantity, reason: reason || null, createdById: user.id },
    });
  });

  revalidatePath("/settings/stock");
  return { ok: true, message: "ปรับสต็อกเรียบร้อย" };
}

export async function deleteProduct(id: string): Promise<ActionResult> {
  await requireUser();
  await prisma.product.delete({ where: { id } });
  revalidatePath("/settings/stock");
  return { ok: true, message: "ลบสินค้าเรียบร้อย" };
}

/* ---------------- Room categories ---------------- */

const roomCategorySchema = z.object({
  id: z.string().optional(),
  name: z.string().min(1, "กรุณากรอกชื่อหมวดหมู่"),
  billingUnit: z.enum(["PER_NIGHT", "PER_VISIT"]),
  sortOrder: z.coerce.number().int().default(0),
  description: z.string().optional(),
  active: z.coerce.boolean().default(true),
});

export async function upsertRoomCategory(input: unknown): Promise<ActionResult> {
  await requireUser();
  const parsed = roomCategorySchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message };
  const { id, ...data } = parsed.data;

  try {
    if (id) {
      await prisma.roomCategory.update({ where: { id }, data });
    } else {
      await prisma.roomCategory.create({ data });
    }
  } catch {
    return { ok: false, error: "ชื่อหมวดหมู่นี้มีอยู่แล้ว" };
  }
  revalidatePath("/settings/rooms");
  return { ok: true, message: "บันทึกหมวดหมู่เรียบร้อย" };
}

export async function deleteRoomCategory(id: string): Promise<ActionResult> {
  await requireUser();
  const roomCount = await prisma.room.count({ where: { categoryId: id } });
  if (roomCount > 0) {
    return { ok: false, error: "ลบไม่ได้ ยังมีห้อง/พื้นที่ในหมวดนี้อยู่ กรุณาย้ายหรือลบห้องก่อน" };
  }
  await prisma.roomCategory.delete({ where: { id } });
  revalidatePath("/settings/rooms");
  return { ok: true, message: "ลบหมวดหมู่เรียบร้อย" };
}

/* ---------------- Rooms ---------------- */

const roomSchema = z.object({
  id: z.string().optional(),
  categoryId: z.string().min(1, "กรุณาเลือกหมวดหมู่"),
  name: z.string().min(1, "กรุณากรอกชื่อ/เลขห้อง"),
  sortOrder: z.coerce.number().int().default(0),
  size: z.enum(["SMALL", "MEDIUM", "LARGE", "XLARGE"]).optional(),
  hasAir: z.coerce.boolean().default(false),
  hasFan: z.coerce.boolean().default(false),
  pricePerNight: z.coerce.number().int().min(0),
  equipment: z.string().optional(),
  description: z.string().optional(),
  active: z.coerce.boolean().default(true),
});

export async function upsertRoom(input: unknown): Promise<ActionResult> {
  await requireUser();
  const parsed = roomSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message };
  const { id, ...data } = parsed.data;

  try {
    if (id) {
      await prisma.room.update({ where: { id }, data });
    } else {
      await prisma.room.create({ data });
    }
  } catch {
    return { ok: false, error: "ชื่อ/เลขยูนิตนี้มีอยู่แล้วในหมวดนี้" };
  }
  revalidatePath("/settings/rooms");
  return { ok: true, message: "บันทึกห้องพักเรียบร้อย" };
}

export async function deleteRoom(id: string): Promise<ActionResult> {
  await requireUser();
  await prisma.room.delete({ where: { id } });
  revalidatePath("/settings/rooms");
  return { ok: true, message: "ลบห้องพักเรียบร้อย" };
}

/* ---------------- Bank Accounts (ADMIN only) ---------------- */

const bankSchema = z.object({
  id: z.string().optional(),
  bankName: z.string().min(1, "กรุณากรอกชื่อธนาคาร/ช่องทาง"),
  accountName: z.string().min(1, "กรุณากรอกชื่อบัญชี"),
  accountNumber: z.string().min(1, "กรุณากรอกเลขบัญชี"),
  promptpayId: z.string().optional(),
  type: z.enum(["PROMPTPAY", "BANK"]).default("BANK"),
  isDefault: z.coerce.boolean().default(false),
  active: z.coerce.boolean().default(true),
});

export async function upsertBankAccount(input: unknown): Promise<ActionResult> {
  await requireAdmin();
  const parsed = bankSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message };
  const { id, ...data } = parsed.data;

  await prisma.$transaction(async (tx) => {
    // ให้มี default ได้เพียงหนึ่งเดียวต่อ PromptPay
    if (data.isDefault && data.type === "PROMPTPAY") {
      await tx.bankAccount.updateMany({
        where: { type: "PROMPTPAY", isDefault: true },
        data: { isDefault: false },
      });
    }
    if (id) {
      await tx.bankAccount.update({ where: { id }, data });
    } else {
      await tx.bankAccount.create({ data });
    }
  });

  revalidatePath("/settings/bank-accounts");
  return { ok: true, message: "บันทึกบัญชีเรียบร้อย" };
}

export async function deleteBankAccount(id: string): Promise<ActionResult> {
  await requireAdmin();
  await prisma.bankAccount.delete({ where: { id } });
  revalidatePath("/settings/bank-accounts");
  return { ok: true, message: "ลบบัญชีเรียบร้อย" };
}

/* ---------------- Users (ADMIN only) ---------------- */

const userCreateSchema = z.object({
  username: z.string().min(3, "ชื่อผู้ใช้อย่างน้อย 3 ตัวอักษร"),
  name: z.string().min(1, "กรุณากรอกชื่อ"),
  email: z.string().optional(),
  password: z.string().min(4, "รหัสผ่านอย่างน้อย 4 ตัวอักษร"),
  role: z.enum(["ADMIN", "USER"]).default("USER"),
});

export async function createUser(input: unknown): Promise<ActionResult> {
  await requireAdmin();
  const parsed = userCreateSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message };
  const { password, ...rest } = parsed.data;

  try {
    await prisma.user.create({
      data: { ...rest, email: rest.email || null, passwordHash: await bcrypt.hash(password, 10) },
    });
  } catch {
    return { ok: false, error: "ชื่อผู้ใช้หรืออีเมลนี้มีอยู่แล้ว" };
  }
  revalidatePath("/settings/users");
  return { ok: true, message: "เพิ่มผู้ใช้งานเรียบร้อย" };
}

const userUpdateSchema = z.object({
  id: z.string(),
  name: z.string().min(1),
  email: z.string().optional(),
  role: z.enum(["ADMIN", "USER"]),
  active: z.coerce.boolean(),
  password: z.string().optional(),
});

export async function updateUser(input: unknown): Promise<ActionResult> {
  await requireAdmin();
  const parsed = userUpdateSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message };
  const { id, password, ...rest } = parsed.data;

  await prisma.user.update({
    where: { id },
    data: {
      ...rest,
      email: rest.email || null,
      ...(password ? { passwordHash: await bcrypt.hash(password, 10) } : {}),
    },
  });
  revalidatePath("/settings/users");
  return { ok: true, message: "อัปเดตผู้ใช้งานเรียบร้อย" };
}

export async function deleteUser(id: string): Promise<ActionResult> {
  const me = await requireAdmin();
  if (me.id === id) return { ok: false, error: "ไม่สามารถลบบัญชีตัวเองได้" };
  await prisma.user.delete({ where: { id } });
  revalidatePath("/settings/users");
  return { ok: true, message: "ลบผู้ใช้งานเรียบร้อย" };
}
