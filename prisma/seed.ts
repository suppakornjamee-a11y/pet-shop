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

  // ----- Rooms -----
  const rooms = [
    { name: "A1", size: "SMALL" as const, hasAir: false, hasFan: true, pricePerNight: 250, equipment: "ที่นอน,ชามอาหาร" },
    { name: "A2", size: "SMALL" as const, hasAir: false, hasFan: true, pricePerNight: 250, equipment: "ที่นอน,ชามอาหาร" },
    { name: "B1", size: "MEDIUM" as const, hasAir: true, hasFan: false, pricePerNight: 400, equipment: "ที่นอน,ชามอาหาร,ของเล่น" },
    { name: "B2", size: "MEDIUM" as const, hasAir: true, hasFan: false, pricePerNight: 400, equipment: "ที่นอน,ชามอาหาร,ของเล่น" },
    { name: "VIP1", size: "LARGE" as const, hasAir: true, hasFan: true, pricePerNight: 650, equipment: "ที่นอนพิเศษ,กล้องวงจรปิด,ของเล่น" },
    { name: "VIP2", size: "XLARGE" as const, hasAir: true, hasFan: true, pricePerNight: 900, equipment: "ที่นอนพิเศษ,กล้องวงจรปิด,ของเล่น,พื้นที่วิ่งเล่น" },
  ];
  for (const r of rooms) {
    await prisma.room.upsert({ where: { name: r.name }, update: {}, create: r });
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
