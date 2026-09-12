/**
 * ดึงเฉพาะ "รายการอาหาร/สินค้า" จากฐานข้อมูลที่ DATABASE_URL ชี้อยู่ ออกเป็น prisma/products.json
 * ใช้: npm run db:export-products   (รันบนเครื่อง local)
 *
 * ตัด createdById/updatedById ออก เพราะ id ผู้ใช้ของ local ไม่มีอยู่จริงบน production
 */
import "dotenv/config";
import { writeFileSync } from "node:fs";
import { join } from "node:path";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client";

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }),
});

async function main() {
  const rows = await prisma.product.findMany({ orderBy: { createdAt: "asc" } });
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const products = rows.map(({ createdById, updatedById, ...p }) => p);

  const out = join(process.cwd(), "prisma", "products.json");
  writeFileSync(out, JSON.stringify(products, null, 2), "utf8");
  console.log(`exported ${products.length} products -> ${out}`);
  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
