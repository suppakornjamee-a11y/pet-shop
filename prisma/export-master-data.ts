/**
 * ดึงเฉพาะ "ข้อมูลตั้งค่า/master data" จากฐานข้อมูลปัจจุบัน (local) ออกเป็นไฟล์ JSON
 * ไม่รวมข้อมูลลูกค้า/สัตว์เลี้ยง/ออเดอร์/การชำระเงิน และไม่รวมบัญชีผู้ใช้งาน (User)
 * ใช้: npm run db:export-master   (อ่าน DATABASE_URL จาก .env)
 */
import "dotenv/config";
import { writeFileSync } from "node:fs";
import { join } from "node:path";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });

async function main() {
  const products = await prisma.product.findMany();

  const data = {
    service: await prisma.service.findMany(),
    roomCategory: await prisma.roomCategory.findMany(),
    room: await prisma.room.findMany(),
    // ตัด createdById/updatedById ออก เพราะไม่ได้ส่งข้อมูล User ไปด้วย
    // (id ผู้ใช้บนเครื่อง local จะไม่มีอยู่จริงบน production)
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    product: products.map(({ createdById, updatedById, ...p }) => p),
    bankAccount: await prisma.bankAccount.findMany(),
    setting: await prisma.setting.findMany(),
  };

  const out = join(process.cwd(), "prisma", "master-data.json");
  writeFileSync(out, JSON.stringify(data, null, 2), "utf8");

  const counts = Object.entries(data)
    .map(([k, v]) => `${k}=${v.length}`)
    .join(", ");
  console.log(`✅ Exported -> prisma/master-data.json`);
  console.log(`   ${counts}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
