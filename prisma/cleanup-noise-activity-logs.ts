/**
 * ลบประวัติการทำรายการ (OrderActivityLog) ที่เป็น "ข้อมูลที่ไม่จำเป็น" ของออเดอร์ย้อนหลัง — สองแบบ:
 *   1. ผลตรวจยาเห็บหมัดตอนจองระดับเขียว (ผ่านปกติ ไม่มีอะไรต้องตามต่อ)
 *   2. ลูกค้ายืนยันว่าข้อมูลสัตว์เลี้ยงเดิมยังถูกต้อง (ไม่มีอะไรเปลี่ยน ไม่มีอะไรให้พนักงานต้องรู้)
 *
 * โค้ดฝั่งสร้างออเดอร์ (src/lib/booking-request.ts) เลิกสร้างสองแบบนี้แล้ว — สคริปต์นี้ไว้ล้างของเก่า
 * ที่เคยสร้างไปแล้วในฐานข้อมูลออกเท่านั้น ไม่กระทบระดับเหลือง/แดง หรือ "ลูกค้าอัปเดตข้อมูลสัตว์เลี้ยงก่อนจอง"
 *
 * ใช้งาน — ดูก่อนว่าจะลบกี่แถว (ไม่แตะข้อมูลจริง):
 *     npx tsx prisma/cleanup-noise-activity-logs.ts
 * ลงมือจริง:
 *     npx tsx prisma/cleanup-noise-activity-logs.ts --confirm
 */
import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client";

const CONFIRM = process.argv.includes("--confirm");

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

const PATTERNS = ["ตรวจยาเห็บหมัดตอนจอง [เขียว]: %", "ลูกค้ายืนยันว่าข้อมูลสัตว์เลี้ยงเดิมยังถูกต้อง%"];

async function main() {
  console.log(`ฐานข้อมูลเป้าหมาย: ${describeTarget()}`);
  const where = { OR: PATTERNS.map((p) => ({ action: { startsWith: p.replace(/%$/, "") } })) };

  const rows = await prisma.orderActivityLog.findMany({
    where,
    select: { id: true, orderId: true, action: true, createdAt: true },
    orderBy: { createdAt: "desc" },
  });

  console.log(`พบ ${rows.length} แถวที่ตรงเงื่อนไข`);
  for (const r of rows.slice(0, 20)) {
    console.log(`  - [${r.orderId}] ${r.action}`);
  }
  if (rows.length > 20) console.log(`  ... และอีก ${rows.length - 20} แถว`);

  if (!CONFIRM) {
    console.log("\nนี่คือ dry-run ยังไม่ได้ลบอะไร — รันซ้ำพร้อม --confirm เพื่อลบจริง");
    return;
  }
  const { count } = await prisma.orderActivityLog.deleteMany({ where });
  console.log(`\nลบไปแล้ว ${count} แถว`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
