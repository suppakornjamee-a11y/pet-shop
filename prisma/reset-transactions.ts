/**
 * ล้าง "ข้อมูลที่เกิดจากการใช้งาน" ออกจากฐานข้อมูลที่ DATABASE_URL ชี้อยู่ แล้วโหลดรายการสินค้าใหม่
 * จาก prisma/products.json (ได้จาก npm run db:export-products บนเครื่อง local)
 *
 * ลบ:  ออเดอร์ · รายการในออเดอร์ · การชำระเงิน · ประวัติการทำรายการ · ค่าใช้จ่ายเพิ่มเติม
 *      · ความเคลื่อนไหวสต็อก · สินค้าเดิมทั้งหมด (แล้วใส่ชุดใหม่แทน)
 *
 * เก็บ: ผู้ใช้งาน · ลูกค้า · สัตว์เลี้ยง · บริการ · หมวดห้อง/ห้องพัก · ช่องทางชำระเงิน
 *      · ตั้งค่าร้าน · วันหยุด
 *
 * ใช้งาน — ดูก่อนว่าจะลบอะไรบ้าง (ไม่แตะข้อมูลจริง):
 *     npx tsx prisma/reset-transactions.ts
 * ลงมือจริง:
 *     npx tsx prisma/reset-transactions.ts --confirm
 * ลบวันหยุดด้วย (ปกติไม่ลบ):
 *     npx tsx prisma/reset-transactions.ts --confirm --wipe-holidays
 */
import "dotenv/config";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client";

const CONFIRM = process.argv.includes("--confirm");
const WIPE_HOLIDAYS = process.argv.includes("--wipe-holidays");
const PRODUCTS_FILE = join(process.cwd(), "prisma", "products.json");

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }),
});

/** โชว์ว่ากำลังต่อกับฐานข้อมูลไหนอยู่ โดยไม่พ่นรหัสผ่านออกมา */
function describeTarget(): string {
  const raw = process.env.DATABASE_URL ?? "";
  try {
    const u = new URL(raw);
    return `${u.hostname}:${u.port || "5432"}${u.pathname}`;
  } catch {
    return "(อ่าน DATABASE_URL ไม่ได้)";
  }
}

async function snapshot() {
  const [
    users, customers, pets, services, roomCategories, rooms, bankAccounts, settings, holidays,
    orders, orderItems, payments, activityLogs, extraCharges, stockMovements, products,
  ] = await Promise.all([
    prisma.user.count(), prisma.customer.count(), prisma.pet.count(),
    prisma.service.count(), prisma.roomCategory.count(), prisma.room.count(),
    prisma.bankAccount.count(), prisma.setting.count(), prisma.holiday.count(),
    prisma.order.count(), prisma.orderItem.count(), prisma.payment.count(),
    prisma.orderActivityLog.count(), prisma.orderExtraCharge.count(),
    prisma.stockMovement.count(), prisma.product.count(),
  ]);
  return {
    keep: { users, customers, pets, services, roomCategories, rooms, bankAccounts, settings, holidays },
    clear: { orders, orderItems, payments, activityLogs, extraCharges, stockMovements, products },
  };
}

function printTable(title: string, rows: Record<string, number>) {
  console.log(`\n${title}`);
  for (const [k, v] of Object.entries(rows)) console.log(`  ${k.padEnd(16)} ${v}`);
}

async function main() {
  if (!existsSync(PRODUCTS_FILE)) {
    console.error(`ไม่พบ ${PRODUCTS_FILE} — รัน npm run db:export-products บนเครื่อง local ก่อน`);
    process.exit(1);
  }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const products: any[] = JSON.parse(readFileSync(PRODUCTS_FILE, "utf8"));

  console.log(`ฐานข้อมูลปลายทาง : ${describeTarget()}`);
  console.log(`สินค้าที่จะนำเข้า  : ${products.length} รายการ`);

  const before = await snapshot();
  printTable("เก็บไว้ (ไม่แตะ)", before.keep);
  printTable("จะถูกลบ", before.clear);
  if (WIPE_HOLIDAYS) console.log(`\n  * --wipe-holidays: จะลบวันหยุด ${before.keep.holidays} รายการด้วย`);

  if (!CONFIRM) {
    console.log("\nโหมดดูอย่างเดียว — ยังไม่ได้ลบอะไร");
    console.log("ถ้าตัวเลขถูกต้องแล้ว สั่งซ้ำโดยเติม --confirm ต่อท้าย");
    await prisma.$disconnect();
    return;
  }

  console.log("\nกำลังลบ...");
  // ไล่ลบลูกก่อนพ่อแม่ตามสาย FK — ถึงจะมี onDelete: Cascade อยู่แล้ว แต่ลบเองทีละชั้น
  // จะรายงานจำนวนจริงของแต่ละตารางได้ ตรวจทานง่ายกว่า
  console.log(`  payment          -${(await prisma.payment.deleteMany()).count}`);
  console.log(`  orderItem        -${(await prisma.orderItem.deleteMany()).count}`);
  console.log(`  orderActivityLog -${(await prisma.orderActivityLog.deleteMany()).count}`);
  console.log(`  orderExtraCharge -${(await prisma.orderExtraCharge.deleteMany()).count}`);
  console.log(`  order            -${(await prisma.order.deleteMany()).count}`);
  console.log(`  stockMovement    -${(await prisma.stockMovement.deleteMany()).count}`);
  console.log(`  product          -${(await prisma.product.deleteMany()).count}`);
  if (WIPE_HOLIDAYS) console.log(`  holiday          -${(await prisma.holiday.deleteMany()).count}`);

  console.log("\nกำลังนำเข้าสินค้า...");
  const inserted = await prisma.product.createMany({ data: products, skipDuplicates: true });
  console.log(`  product          +${inserted.count}`);

  const after = await snapshot();
  printTable("คงเหลือหลังทำงาน (ต้องเท่าเดิม)", after.keep);
  printTable("ข้อมูลใช้งาน", after.clear);

  await prisma.$disconnect();
}

main().catch(async (e) => {
  console.error(e);
  await prisma.$disconnect();
  process.exit(1);
});
