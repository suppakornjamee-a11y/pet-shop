/**
 * นำข้อมูลจาก prisma/seed-data.json เข้าสู่ฐานข้อมูลที่ DATABASE_URL ชี้อยู่
 * ใช้: (ตั้ง DATABASE_URL เป็น cloud ก่อน) แล้ว  npm run db:import
 * ปลอดภัยกับข้อมูลเดิม: ใช้ skipDuplicates (ข้ามเรคคอร์ดที่ id ซ้ำ)
 */
import "dotenv/config";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });

async function main() {
  const file = join(process.cwd(), "prisma", "seed-data.json");
  // ใช้ any เพราะข้อมูลมาจาก JSON — ปล่อยให้ createMany รับได้ตามชนิดจริง
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const data: any = JSON.parse(readFileSync(file, "utf8"));

  const log = (name: string, r: { count: number }, total: number) =>
    console.log(`✓ ${name}: +${r.count} / ${total}`);

  // เรียงตามลำดับ FK
  log("user", await prisma.user.createMany({ data: data.user ?? [], skipDuplicates: true }), (data.user ?? []).length);
  log("customer", await prisma.customer.createMany({ data: data.customer ?? [], skipDuplicates: true }), (data.customer ?? []).length);
  log("pet", await prisma.pet.createMany({ data: data.pet ?? [], skipDuplicates: true }), (data.pet ?? []).length);
  log("service", await prisma.service.createMany({ data: data.service ?? [], skipDuplicates: true }), (data.service ?? []).length);
  log("room", await prisma.room.createMany({ data: data.room ?? [], skipDuplicates: true }), (data.room ?? []).length);
  log("product", await prisma.product.createMany({ data: data.product ?? [], skipDuplicates: true }), (data.product ?? []).length);
  log("bankAccount", await prisma.bankAccount.createMany({ data: data.bankAccount ?? [], skipDuplicates: true }), (data.bankAccount ?? []).length);
  log("setting", await prisma.setting.createMany({ data: data.setting ?? [], skipDuplicates: true }), (data.setting ?? []).length);
  log("order", await prisma.order.createMany({ data: data.order ?? [], skipDuplicates: true }), (data.order ?? []).length);
  log("orderItem", await prisma.orderItem.createMany({ data: data.orderItem ?? [], skipDuplicates: true }), (data.orderItem ?? []).length);
  log("payment", await prisma.payment.createMany({ data: data.payment ?? [], skipDuplicates: true }), (data.payment ?? []).length);
  log("stockMovement", await prisma.stockMovement.createMany({ data: data.stockMovement ?? [], skipDuplicates: true }), (data.stockMovement ?? []).length);

  console.log("✅ Import complete");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
