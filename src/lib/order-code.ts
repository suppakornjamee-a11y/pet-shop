import { prisma } from "@/lib/prisma";

/**
 * สร้างรหัสออเดอร์รูปแบบ ORD-YYYYMMDD-NNNN (running ต่อวัน ตามเวลาไทย)
 * หาเลขล่าสุดที่มีอยู่จริงของวันนั้นแล้ว +1 (ไม่พึ่งการนับ/timezone ของ server)
 */
export async function generateOrderCode(): Promise<string> {
  // ใช้เวลาไทย (Asia/Bangkok) เป็น prefix — กัน server ที่รันเป็น UTC (เช่น Vercel)
  const datePart = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Bangkok",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  })
    .format(new Date())
    .replace(/-/g, ""); // เช่น 20260812

  const prefix = `ORD-${datePart}-`;

  const last = await prisma.order.findFirst({
    where: { code: { startsWith: prefix } },
    orderBy: { code: "desc" },
    select: { code: true },
  });

  let next = 1;
  if (last) {
    const n = parseInt(last.code.slice(prefix.length), 10);
    if (!Number.isNaN(n)) next = n + 1;
  }

  return `${prefix}${String(next).padStart(4, "0")}`;
}
