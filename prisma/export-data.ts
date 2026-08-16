/**
 * ดึงข้อมูลทั้งหมดจากฐานข้อมูลปัจจุบัน (local) ออกเป็นไฟล์ JSON
 * ใช้: npm run db:export   (อ่าน DATABASE_URL จาก .env)
 */
import "dotenv/config";
import { writeFileSync } from "node:fs";
import { join } from "node:path";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });

async function main() {
  const data = {
    user: await prisma.user.findMany(),
    customer: await prisma.customer.findMany(),
    pet: await prisma.pet.findMany(),
    service: await prisma.service.findMany(),
    roomCategory: await prisma.roomCategory.findMany(),
    room: await prisma.room.findMany(),
    product: await prisma.product.findMany(),
    bankAccount: await prisma.bankAccount.findMany(),
    setting: await prisma.setting.findMany(),
    order: await prisma.order.findMany(),
    orderItem: await prisma.orderItem.findMany(),
    payment: await prisma.payment.findMany(),
    stockMovement: await prisma.stockMovement.findMany(),
  };

  const out = join(process.cwd(), "prisma", "seed-data.json");
  writeFileSync(out, JSON.stringify(data, null, 2), "utf8");

  const counts = Object.entries(data)
    .map(([k, v]) => `${k}=${v.length}`)
    .join(", ");
  console.log(`✅ Exported -> prisma/seed-data.json`);
  console.log(`   ${counts}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
