import "dotenv/config";
import bcrypt from "bcryptjs";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });

async function main() {
  console.log("🌱 Seeding database...");

  // ----- Users -----
  const adminHash = await bcrypt.hash("admin", 10);
  const userHash = await bcrypt.hash("user", 10);

  await prisma.user.upsert({
    where: { username: "admin" },
    update: {},
    create: {
      username: "admin",
      name: "ผู้ดูแลระบบ",
      email: "admin@petcare.local",
      passwordHash: adminHash,
      role: "ADMIN",
    },
  });

  await prisma.user.upsert({
    where: { username: "user" },
    update: {},
    create: {
      username: "user",
      name: "พนักงานหน้าร้าน",
      email: "user@petcare.local",
      passwordHash: userHash,
      role: "USER",
    },
  });

  // ----- Services -----
  const services = [
    { name: "อาบน้ำทั่วไป", category: "BATH" as const, price: 250 },
    { name: "อาบน้ำพิเศษ", category: "BATH" as const, price: 350 },
    { name: "อาบน้ำแบบพรีเมี่ยม", category: "BATH" as const, price: 500 },
    { name: "ตัดขน (สไตล์พื้นฐาน)", category: "GROOMING" as const, price: 500 },
    { name: "ตัดขน (สไตล์พิเศษ)", category: "GROOMING" as const, price: 800 },
    { name: "ตัดเล็บ + ทำความสะอาดหู", category: "OTHER" as const, price: 150 },
  ];
  for (const s of services) {
    const exists = await prisma.service.findFirst({ where: { name: s.name } });
    if (!exists) await prisma.service.create({ data: s });
  }

  // ----- Room categories + rooms -----
  // หมวดหมู่ตามระบบจองจริงของร้าน (Daycare / Nanny Room / Big Dog / Small Dog / Cat / Pawsome)
  // ราคาตั้งไว้ 0 บาทเป็นค่าเริ่มต้น (ไม่มีราคาจริงในชีทตัวอย่าง) — ปรับได้ที่หน้า "ตั้งค่า > ห้องพัก"
  const categoryDefs = [
    { name: "Daycare", billingUnit: "PER_VISIT" as const, sortOrder: 10 },
    { name: "Nanny Room", billingUnit: "PER_NIGHT" as const, sortOrder: 20 },
    { name: "BIG DOG", billingUnit: "PER_NIGHT" as const, sortOrder: 30 },
    { name: "SMALL DOG", billingUnit: "PER_NIGHT" as const, sortOrder: 40 },
    { name: "CAT", billingUnit: "PER_NIGHT" as const, sortOrder: 50 },
    { name: "Pawsome Play", billingUnit: "PER_VISIT" as const, sortOrder: 60, description: "ห้องวิ่งเล่นสุนัข/แมวไซส์เล็ก" },
    { name: "Pawsome Park", billingUnit: "PER_VISIT" as const, sortOrder: 70, description: "สนามวิ่งเล่นสุนัขกลางแจ้ง" },
    { name: "Pawsome Fountain", billingUnit: "PER_VISIT" as const, sortOrder: 80, description: "ลานน้ำพุสุนัขเล็ก/ใหญ่" },
  ];
  const categoryByName: Record<string, { id: string }> = {};
  for (const c of categoryDefs) {
    const cat = await prisma.roomCategory.upsert({ where: { name: c.name }, update: {}, create: c });
    categoryByName[c.name] = cat;
  }

  const roomsByCategory: Record<string, { name: string; equipment?: string; sortOrder: number }[]> = {
    Daycare: [
      { name: "Small Dog เลนที่ 1", sortOrder: 1 },
      { name: "Small Dog เลนที่ 2", sortOrder: 2 },
      { name: "Small Dog เลนที่ 3", sortOrder: 3 },
      { name: "Small Dog เลนที่ 4", sortOrder: 4 },
      { name: "Big Dog", sortOrder: 5 },
      { name: "Cat", sortOrder: 6 },
    ],
    "Nanny Room": [
      { name: "Dog (มีห้องน้ำ)", equipment: "มีห้องน้ำ,+150/คืน", sortOrder: 1 },
      { name: "Dog (ห้อง Store)", equipment: "ห้อง Store,+150/คืน", sortOrder: 2 },
      { name: "ห้องเดี่ยวไม่ได้เดี่ยว (Small Dog)", equipment: "+150/คืน", sortOrder: 3 },
      { name: "Small Dog คอกพลาสติก 1", equipment: "คอกพลาสติก,+100/คืน", sortOrder: 4 },
      { name: "Small Dog คอกพลาสติก 2", equipment: "คอกพลาสติก,+100/คืน", sortOrder: 5 },
      { name: "Small Dog คอกพลาสติก 3", equipment: "คอกพลาสติก,+100/คืน", sortOrder: 6 },
      { name: "Big Dog คอกพลาสติก", equipment: "คอกพลาสติก,+100/คืน", sortOrder: 7 },
    ],
    "BIG DOG": [
      { name: "1 (พิเศษช่วงปีใหม่)", equipment: "สำหรับสุนัขที่อุ้มขึ้นได้", sortOrder: 1 },
      { name: "2 (พิเศษช่วงปีใหม่)", equipment: "สำหรับสุนัขที่อุ้มขึ้นได้", sortOrder: 2 },
      { name: "3 (พิเศษช่วงปีใหม่)", equipment: "สำหรับสุนัขที่อุ้มขึ้นได้", sortOrder: 3 },
      { name: "1 (คอกเบอร์ 5)", sortOrder: 4 },
      { name: "2 (คอกเบอร์ 6)", sortOrder: 5 },
      { name: "3 (คอกเบอร์ 7)", equipment: "+50", sortOrder: 6 },
      { name: "4 (คอกเบอร์ 8)", equipment: "+50", sortOrder: 7 },
    ],
    "SMALL DOG": Array.from({ length: 14 }, (_, i) => ({ name: String(i + 1), sortOrder: i + 1 })),
    CAT: Array.from({ length: 8 }, (_, i) => ({ name: String(i + 1), sortOrder: i + 1 })),
    "Pawsome Play": [
      { name: "เลนที่ 1", sortOrder: 1 },
      { name: "เลนที่ 2", sortOrder: 2 },
      { name: "เลนที่ 3", sortOrder: 3 },
    ],
    "Pawsome Park": [{ name: "สนามวิ่งเล่น", sortOrder: 1 }],
    "Pawsome Fountain": [
      { name: "ลานน้ำพุ (เล็ก)", sortOrder: 1 },
      { name: "ลานน้ำพุ (ใหญ่)", sortOrder: 2 },
    ],
  };

  for (const [categoryName, rooms] of Object.entries(roomsByCategory)) {
    const category = categoryByName[categoryName];
    for (const r of rooms) {
      await prisma.room.upsert({
        where: { categoryId_name: { categoryId: category.id, name: r.name } },
        update: {},
        create: {
          categoryId: category.id,
          name: r.name,
          sortOrder: r.sortOrder,
          pricePerNight: 0,
          equipment: r.equipment,
        },
      });
    }
  }

  // ----- Products (pet) -----
  const products = [
    { name: "ขนมสุนัข Jerky", category: "ขนม", price: 50, stockQty: 40, unit: "ซอง" },
    { name: "ขนมแมว Churu", category: "ขนม", price: 40, stockQty: 60, unit: "ซอง" },
    { name: "อาหารเปียกสุนัข", category: "อาหารเปียก", price: 45, stockQty: 30, unit: "กระป๋อง" },
    { name: "อาหารเปียกแมว", category: "อาหารเปียก", price: 35, stockQty: 50, unit: "กระป๋อง" },
    { name: "อาหารเม็ดสุนัข (ถ้วย)", category: "อาหารเม็ด", price: 60, stockQty: 25, unit: "ถ้วย" },
  ];
  for (const p of products) {
    const exists = await prisma.product.findFirst({ where: { name: p.name } });
    if (!exists) await prisma.product.create({ data: { ...p, target: "PET" } });
  }

  // ----- Bank accounts -----
  const ppExists = await prisma.bankAccount.findFirst({ where: { type: "PROMPTPAY" } });
  if (!ppExists) {
    await prisma.bankAccount.create({
      data: {
        bankName: "PromptPay",
        accountName: "ร้าน PetCare",
        accountNumber: "0812345678",
        promptpayId: "0812345678",
        type: "PROMPTPAY",
        isDefault: true,
      },
    });
  }
  const bankExists = await prisma.bankAccount.findFirst({ where: { type: "BANK" } });
  if (!bankExists) {
    await prisma.bankAccount.create({
      data: {
        bankName: "กสิกรไทย",
        accountName: "ร้าน PetCare",
        accountNumber: "123-4-56789-0",
        type: "BANK",
      },
    });
  }

  // ----- Shop settings -----
  await prisma.setting.upsert({
    where: { key: "shop_name" },
    update: {},
    create: { key: "shop_name", value: "PetCare Grooming & Boarding" },
  });
  await prisma.setting.upsert({
    where: { key: "shop_address" },
    update: {},
    create: { key: "shop_address", value: "123 ถ.สุขุมวิท กรุงเทพฯ 10110 โทร. 081-234-5678" },
  });

  console.log("✅ Seed complete. Login: admin/admin (แอดมิน) หรือ user/user (พนักงาน)");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
