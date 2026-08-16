/**
 * นำ "ข้อมูลตั้งค่า/master data" จาก prisma/master-data.json เข้าสู่ฐานข้อมูลที่ DATABASE_URL ชี้อยู่
 * ใช้: (ตั้ง DATABASE_URL เป็น production ก่อน) แล้ว  npm run db:import-master
 * ปลอดภัยกับข้อมูลเดิม: ใช้ skipDuplicates (ข้ามเรคคอร์ดที่ id ซ้ำ)
 * ไม่แตะข้อมูลลูกค้า/สัตว์เลี้ยง/ออเดอร์/การชำระเงิน/บัญชีผู้ใช้งานเลย
 */
import "dotenv/config";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });

async function main() {
  const file = join(process.cwd(), "prisma", "master-data.json");
  // ใช้ any เพราะข้อมูลมาจาก JSON — ปล่อยให้ createMany รับได้ตามชนิดจริง
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const data: any = JSON.parse(readFileSync(file, "utf8"));

  const log = (name: string, r: { count: number }, total: number) =>
    console.log(`✓ ${name}: +${r.count} / ${total}`);

  // เรียงตามลำดับ FK: roomCategory ต้องมาก่อน room
  log(
    "roomCategory",
    await prisma.roomCategory.createMany({ data: data.roomCategory ?? [], skipDuplicates: true }),
    (data.roomCategory ?? []).length
  );
  log("room", await prisma.room.createMany({ data: data.room ?? [], skipDuplicates: true }), (data.room ?? []).length);
  log("service", await prisma.service.createMany({ data: data.service ?? [], skipDuplicates: true }), (data.service ?? []).length);
  log("product", await prisma.product.createMany({ data: data.product ?? [], skipDuplicates: true }), (data.product ?? []).length);
  log(
    "bankAccount",
    await prisma.bankAccount.createMany({ data: data.bankAccount ?? [], skipDuplicates: true }),
    (data.bankAccount ?? []).length
  );
  log("setting", await prisma.setting.createMany({ data: data.setting ?? [], skipDuplicates: true }), (data.setting ?? []).length);

  console.log("✅ Master data import complete");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
