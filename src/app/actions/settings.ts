"use server";

import { z } from "zod";
import bcrypt from "bcryptjs";
import ExcelJS from "exceljs";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireUser, requireAdmin } from "@/lib/auth-helpers";
import { SHOP_INFO_KEYS } from "@/lib/settings";
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

/* ---------------- นำเข้า/ส่งออกสินค้า (Excel) — ร้านค้า & คาเฟ่ ---------------- */

const PRODUCT_IMPORT_HEADERS = [
  "ชื่อสินค้า",
  "หมวด (ของสัตว์ / ของคน)",
  "ประเภท",
  "ราคาขาย",
  "ต้นทุน",
  "หน่วย",
  "จำนวนคงเหลือ",
];

/** สร้างไฟล์ Excel เปล่าพร้อม header + แถวตัวอย่าง ให้ดาวน์โหลดไปกรอกแล้วนำเข้ากลับ */
export async function exportProductTemplate(): Promise<
  { ok: true; base64: string; filename: string } | { ok: false; error: string }
> {
  await requireUser();

  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet("สินค้า");
  sheet.addRow(PRODUCT_IMPORT_HEADERS);
  sheet.addRow(["ขนมสุนัข Jerky", "ของสัตว์", "ขนม", 50, 30, "ซอง", 100]);
  sheet.getRow(1).font = { bold: true };
  sheet.columns.forEach((col) => {
    col.width = 22;
  });

  const buffer = await workbook.xlsx.writeBuffer();
  return {
    ok: true,
    base64: Buffer.from(buffer).toString("base64"),
    filename: "แบบฟอร์มนำเข้าสินค้า.xlsx",
  };
}

const importRowSchema = z.object({
  name: z.string().min(1),
  target: z.enum(["PET", "HUMAN"]),
  category: z.string().optional(),
  price: z.coerce.number().int().min(0),
  cost: z.coerce.number().int().min(0).optional(),
  unit: z.string().min(1).default("ชิ้น"),
  stockQty: z.coerce.number().int().min(0).default(0),
});

/** นำเข้าสินค้าจำนวนมากจากไฟล์ Excel (แถวไหนชื่อซ้ำของเดิม = อัปเดตราคา/สต็อกทับ) */
export async function importProducts(formData: FormData): Promise<ActionResult> {
  const user = await requireUser();
  const file = formData.get("file");
  if (!(file instanceof File)) return { ok: false, error: "กรุณาเลือกไฟล์" };

  const arrayBuffer = await file.arrayBuffer();
  const workbook = new ExcelJS.Workbook();
  try {
    await workbook.xlsx.load(arrayBuffer);
  } catch {
    return { ok: false, error: "อ่านไฟล์ไม่ได้ กรุณาใช้ไฟล์ .xlsx ตามแบบฟอร์ม" };
  }
  const sheet = workbook.worksheets[0];
  if (!sheet) return { ok: false, error: "ไม่พบข้อมูลในไฟล์" };

  let imported = 0;
  let skipped = 0;
  for (let i = 2; i <= sheet.rowCount; i++) {
    const row = sheet.getRow(i);
    const name = String(row.getCell(1).text ?? "").trim();
    if (!name) continue;

    const targetRaw = String(row.getCell(2).text ?? "").trim();
    const parsed = importRowSchema.safeParse({
      name,
      target: targetRaw === "ของคน" ? "HUMAN" : "PET",
      category: String(row.getCell(3).text ?? "").trim() || undefined,
      price: row.getCell(4).value,
      cost: row.getCell(5).value || undefined,
      unit: String(row.getCell(6).text ?? "").trim() || "ชิ้น",
      stockQty: row.getCell(7).value || 0,
    });
    if (!parsed.success) {
      skipped++;
      continue;
    }

    const existing = await prisma.product.findFirst({ where: { name: parsed.data.name } });
    if (existing) {
      await prisma.product.update({
        where: { id: existing.id },
        data: { ...parsed.data, updatedById: user.id },
      });
    } else {
      await prisma.product.create({
        data: { ...parsed.data, createdById: user.id, updatedById: user.id },
      });
    }
    imported++;
  }

  revalidatePath("/shop");
  revalidatePath("/settings/stock");
  return {
    ok: true,
    message:
      skipped > 0
        ? `นำเข้าสำเร็จ ${imported} รายการ (ข้าม ${skipped} แถวที่ข้อมูลไม่ถูกต้อง)`
        : `นำเข้าสำเร็จ ${imported} รายการ`,
  };
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
  hasCctv: z.coerce.boolean().default(false),
  cctvModel: z.string().optional(),
  cctvSerial: z.string().optional(),
  pricePerNight: z.coerce.number().int().min(0),
  equipment: z.string().optional(),
  description: z.string().optional(),
  active: z.coerce.boolean().default(true),
});

export async function upsertRoom(input: unknown): Promise<ActionResult> {
  await requireUser();
  const parsed = roomSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message };
  const { id, ...rest } = parsed.data;
  const data = {
    ...rest,
    cctvModel: rest.hasCctv ? (rest.cctvModel ?? null) : null,
    cctvSerial: rest.hasCctv ? (rest.cctvSerial ?? null) : null,
  };

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

/* ---------------- Services ---------------- */

const serviceSchema = z.object({
  id: z.string().optional(),
  name: z.string().min(1, "กรุณากรอกชื่อบริการ"),
  category: z.enum(["BATH", "GROOMING", "BOARDING", "OTHER"]),
  group: z.enum(["ADDON", "TREATMENT", "SPA"]).optional(),
  speciesScope: z.enum(["DOG", "CAT"]).optional(),
  defaultOn: z.coerce.boolean().default(false),
  sortOrder: z.coerce.number().int().default(0),
  description: z.string().optional(),
  price: z.coerce.number().int().min(0),
  active: z.coerce.boolean().default(true),
  commissionPercent: z.coerce.number().min(0).max(100).optional(),
  commissionFlat: z.coerce.number().int().min(0).optional(),
});

export async function upsertService(input: unknown): Promise<ActionResult> {
  await requireUser();
  const parsed = serviceSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message };
  const { id, ...rest } = parsed.data;
  const data = {
    ...rest,
    group: rest.group ?? null,
    speciesScope: rest.speciesScope ?? null,
    commissionPercent: rest.commissionPercent ?? null,
    commissionFlat: rest.commissionFlat ?? null,
  };

  if (id) {
    await prisma.service.update({ where: { id }, data });
  } else {
    await prisma.service.create({ data });
  }
  revalidatePath("/settings/services");
  revalidatePath("/orders/new");
  return { ok: true, message: "บันทึกบริการเรียบร้อย" };
}

export async function deleteService(id: string): Promise<ActionResult> {
  await requireUser();
  await prisma.service.delete({ where: { id } });
  revalidatePath("/settings/services");
  revalidatePath("/orders/new");
  return { ok: true, message: "ลบบริการเรียบร้อย" };
}

/* ---------------- Bank Accounts (ADMIN only) ---------------- */

const bankSchema = z.object({
  id: z.string().optional(),
  bankName: z.string().min(1, "กรุณากรอกชื่อธนาคาร/ช่องทาง"),
  accountName: z.string().min(1, "กรุณากรอกชื่อบัญชี"),
  accountNumber: z
    .string()
    .min(1, "กรุณากรอกเลขบัญชี")
    .refine((v) => {
      // เครื่องหมาย "-" ใช้คั่นได้ ไม่นับรวมเป็นจำนวนหลัก แต่ที่เหลือต้องเป็นตัวเลขล้วน 10-12 หลัก
      const digitsOnly = v.replace(/-/g, "");
      return /^\d+$/.test(digitsOnly) && digitsOnly.length >= 10 && digitsOnly.length <= 12;
    }, "เลขบัญชีต้องเป็นตัวเลข 10-12 หลัก (คั่นด้วย - ได้ ไม่นับรวมจำนวนหลัก)"),
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
  role: z.enum(["ADMIN", "USER", "GROOMER"]).default("USER"),
  groomerLevel: z.enum(["JUNIOR", "SENIOR"]).optional(),
});

export async function createUser(input: unknown): Promise<ActionResult> {
  await requireAdmin();
  const parsed = userCreateSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message };
  const { password, groomerLevel, role, ...rest } = parsed.data;
  if (role === "GROOMER" && !groomerLevel) {
    return { ok: false, error: "กรุณาเลือกระดับช่างอาบน้ำ (Junior/Senior)" };
  }

  try {
    await prisma.user.create({
      data: {
        ...rest,
        role,
        groomerLevel: role === "GROOMER" ? groomerLevel : null,
        email: rest.email || null,
        passwordHash: await bcrypt.hash(password, 10),
      },
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
  role: z.enum(["ADMIN", "USER", "GROOMER"]),
  active: z.coerce.boolean(),
  password: z.string().optional(),
  groomerLevel: z.enum(["JUNIOR", "SENIOR"]).optional(),
});

export async function updateUser(input: unknown): Promise<ActionResult> {
  await requireAdmin();
  const parsed = userUpdateSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message };
  const { id, password, groomerLevel, role, ...rest } = parsed.data;
  if (role === "GROOMER" && !groomerLevel) {
    return { ok: false, error: "กรุณาเลือกระดับช่างอาบน้ำ (Junior/Senior)" };
  }

  await prisma.user.update({
    where: { id },
    data: {
      ...rest,
      role,
      groomerLevel: role === "GROOMER" ? groomerLevel : null,
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

/* ---------------- วันหยุด / ค่าธรรมเนียมพิเศษ (ADMIN only) ---------------- */

const holidaySchema = z.object({
  id: z.string().optional(),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "รูปแบบวันที่ไม่ถูกต้อง"),
  title: z.string().min(1, "กรุณากรอกชื่อวันหยุด"),
  extraCharge: z.coerce.number().int().min(0),
});

export async function upsertHoliday(input: unknown): Promise<ActionResult> {
  await requireAdmin();
  const parsed = holidaySchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message };
  const { id, date, ...rest } = parsed.data;
  const dateValue = new Date(`${date}T00:00:00+07:00`);

  try {
    if (id) {
      await prisma.holiday.update({ where: { id }, data: { ...rest, date: dateValue } });
    } else {
      await prisma.holiday.create({ data: { ...rest, date: dateValue } });
    }
  } catch {
    return { ok: false, error: "มีวันหยุดของวันที่นี้อยู่แล้ว" };
  }
  revalidatePath("/settings/holidays");
  return { ok: true, message: "บันทึกวันหยุดเรียบร้อย" };
}

export async function deleteHoliday(id: string): Promise<ActionResult> {
  await requireAdmin();
  await prisma.holiday.delete({ where: { id } });
  revalidatePath("/settings/holidays");
  return { ok: true, message: "ลบวันหยุดเรียบร้อย" };
}

/* ---------------- ข้อมูลร้าน (ADMIN only) — ใช้แสดงบนใบเสร็จ ---------------- */

const shopInfoSchema = z.object({
  name: z.string().min(1, "กรุณากรอกชื่อร้าน"),
  address: z.string().optional(),
  taxId: z.string().optional(),
  lineId: z.string().optional(),
  phone: z.string().optional(),
  hours: z.string().optional(),
});

export async function upsertShopInfo(input: unknown): Promise<ActionResult> {
  await requireAdmin();
  const parsed = shopInfoSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message };
  const { name, address, taxId, lineId, phone, hours } = parsed.data;

  const values: Record<string, string> = {
    [SHOP_INFO_KEYS.name]: name,
    [SHOP_INFO_KEYS.address]: address ?? "",
    [SHOP_INFO_KEYS.taxId]: taxId ?? "",
    [SHOP_INFO_KEYS.lineId]: lineId ?? "",
    [SHOP_INFO_KEYS.phone]: phone ?? "",
    [SHOP_INFO_KEYS.hours]: hours ?? "",
  };
  await prisma.$transaction(
    Object.entries(values).map(([key, value]) =>
      prisma.setting.upsert({ where: { key }, create: { key, value }, update: { value } })
    )
  );

  revalidatePath("/settings/shop-info");
  return { ok: true, message: "บันทึกข้อมูลร้านเรียบร้อย" };
}
