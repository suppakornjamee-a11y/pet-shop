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
  // แคตตาล็อกเดิม (ราคาตัวอย่าง) ถูกแทนที่ด้วยรายการใหม่ด้านล่าง — ปิดใช้งานไว้ ไม่ลบ (กันออเดอร์เก่าที่อ้างอิงอยู่พัง)
  await prisma.service.updateMany({
    where: {
      name: {
        in: [
          "อาบน้ำทั่วไป",
          "อาบน้ำพิเศษ",
          "อาบน้ำแบบพรีเมี่ยม",
          "ตัดขน (สไตล์พื้นฐาน)",
          "ตัดขน (สไตล์พิเศษ)",
          "ตัดเล็บ + ทำความสะอาดหู",
        ],
      },
    },
    data: { active: false },
  });

  type ServiceSeed = {
    name: string;
    category: "BATH" | "GROOMING" | "BOARDING" | "OTHER";
    group?: "ADDON" | "TREATMENT" | "SPA";
    speciesScope?: "DOG" | "CAT";
    defaultOn?: boolean;
    price?: number;
  };
  // ราคาประมาณการตามราคาตลาดทั่วไป — ปรับได้จริงที่หน้า "ตั้งค่า > บริการ"
  // รายการที่ defaultOn (รวมอยู่ในอาบน้ำแล้ว) ตั้งราคา 0 ไว้เสมอ เพราะรวมอยู่ในค่าอาบน้ำแล้ว ไม่ได้คิดแยก
  const serviceDefs: ServiceSeed[] = [
    // อาบน้ำ (เลือกได้ตามชนิดสัตว์)
    { name: "อาบน้ำขนสั้น", category: "BATH", price: 300 },
    { name: "อาบน้ำขนยาว", category: "BATH", price: 400 },
    { name: "อาบน้ำขนพิเศษ", category: "BATH", speciesScope: "DOG", price: 500 },
    // รวมอยู่ในอาบน้ำโดยอัตโนมัติ — ถอนออกได้ถ้าลูกค้าไม่รับบริการ
    { name: "ไถเท้า", category: "BATH", defaultOn: true },
    { name: "ไถท้อง", category: "BATH", defaultOn: true },
    { name: "ไถก้น", category: "BATH", defaultOn: true },
    { name: "บีบต่อม", category: "BATH", defaultOn: true },
    { name: "เช็ดหู", category: "BATH", defaultOn: true },
    // ตัดขน
    { name: "ตัดขนสั้น", category: "GROOMING", speciesScope: "DOG", price: 400 },
    { name: "ตัดขนยาว", category: "GROOMING", price: 500 },
    { name: "ตัดขนพิเศษ", category: "GROOMING", speciesScope: "DOG", price: 700 },
    { name: "ตัดขนกรรไกร", category: "GROOMING", speciesScope: "CAT", price: 600 },
    // รายการเพิ่มเติม
    { name: "สางขนพันกัน", category: "BATH", group: "ADDON", price: 150 },
    { name: "ค่าพลัดขน", category: "BATH", group: "ADDON", price: 200 },
    { name: "ทรีทเม้นท์ขนขาว", category: "BATH", group: "ADDON", price: 250 },
    { name: "ทรีทเม้นต์บำรุงขน", category: "BATH", group: "ADDON", price: 250 },
    {
      name: "ทรีทเม้นต์กำจัดคราบมัน",
      category: "BATH",
      group: "ADDON",
      speciesScope: "CAT",
      price: 250,
    },
    { name: "แปรงฟัน", category: "BATH", group: "ADDON", price: 100 },
    { name: "ตัดเล็บ", category: "BATH", group: "ADDON", price: 100 },
    { name: "Paws & Nose Moisture Treatment", category: "BATH", group: "ADDON", price: 200 },
    { name: "ทาแป้งลดคราบน้ำตา", category: "BATH", group: "ADDON", price: 100 },
    // ทรีทเม้นต์
    { name: "ขนขาว", category: "BATH", group: "TREATMENT", price: 300 },
    { name: "บำรุงขน", category: "BATH", group: "TREATMENT", price: 300 },
    { name: "เพิ่มวอลลุ่มขนพิเศษ", category: "BATH", group: "TREATMENT", price: 350 },
    { name: "บำรุงจมูกและอุ้งเท้า", category: "BATH", group: "TREATMENT", price: 250 },
    { name: "ลดคราบน้ำตา", category: "BATH", group: "TREATMENT", price: 200 },
    {
      name: "พรีเมียมทรีทเม้นต์ขนนุ่ม",
      category: "BATH",
      group: "TREATMENT",
      speciesScope: "DOG",
      price: 450,
    },
    {
      name: "ขจัดคราบไขมัน",
      category: "BATH",
      group: "TREATMENT",
      speciesScope: "CAT",
      price: 300,
    },
    {
      name: "พรีเมียมทรีทเม้นต์บำรุงและขจัดคราบไขมัน",
      category: "BATH",
      group: "TREATMENT",
      speciesScope: "CAT",
      price: 450,
    },
    // สปา
    { name: "เกลือกุหลาบ", category: "BATH", group: "SPA", price: 200 },
    { name: "เกลือคาโมมายล์", category: "BATH", group: "SPA", price: 200 },
    { name: "เกลือมะพร้าว", category: "BATH", group: "SPA", price: 200 },
    { name: "เกลือเปปเปอร์มินท์", category: "BATH", group: "SPA", price: 200 },
    { name: "เกลือมาร์ชแมลโลว์", category: "BATH", group: "SPA", price: 200 },
    { name: "เกลือลาเวนเดอร์", category: "BATH", group: "SPA", price: 200 },
    { name: "Mineral Bath Blue Marine", category: "BATH", group: "SPA", price: 350 },
    { name: "Mineral Bath Hot Spring", category: "BATH", group: "SPA", price: 350 },
    { name: "Mineral Bath Rose Salt", category: "BATH", group: "SPA", price: 350 },
    { name: "Bubble Spa", category: "BATH", group: "SPA", price: 300 },
    { name: "สปาโคลน", category: "BATH", group: "SPA", price: 350 },
    // บริการอื่นๆ
    { name: "เทรนนิ่ง", category: "OTHER", price: 500 },
    { name: "ฟิตเนส", category: "OTHER", price: 300 },
    { name: "เล่นน้ำพุ", category: "OTHER", price: 150 },
  ];
  for (const [i, s] of serviceDefs.entries()) {
    const { price, ...rest } = s;
    const exists = await prisma.service.findFirst({ where: { name: s.name } });
    if (!exists) await prisma.service.create({ data: { ...rest, price: price ?? 0, sortOrder: i } });
    else if (exists.price === 0 && (price ?? 0) > 0) {
      await prisma.service.update({ where: { id: exists.id }, data: { price } });
    }
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
