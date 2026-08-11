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
  const data = JSON.parse(readFileSync(file, "utf8"));

  // เรียงตามลำดับ FK
  const steps: [string, { createMany: (a: { data: unknown[]; skipDuplicates: boolean }) => Promise<{ count: number }> }][] = [
    ["user", prisma.user],
    ["customer", prisma.customer],
    ["pet", prisma.pet],
    ["service", prisma.service],
    ["room", prisma.room],
    ["product", prisma.product],
    ["bankAccount", prisma.bankAccount],
    ["setting", prisma.setting],
    ["order", prisma.order],
    ["orderItem", prisma.orderItem],
    ["payment", prisma.payment],
    ["stockMovement", prisma.stockMovement],
  ];

  for (const [key, model] of steps) {
    const rows = (data[key] ?? []) as unknown[];
    if (rows.length === 0) {
      console.log(`- ${key}: 0 (skip)`);
      continue;
    }
    const res = await model.createMany({ data: rows, skipDuplicates: true });
    console.log(`✓ ${key}: +${res.count} / ${rows.length}`);
  }

  console.log("✅ Import complete");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
