import { prisma } from "@/lib/prisma";

/**
 * สร้างรหัสออเดอร์รูปแบบ ORD-YYYYMMDD-NNNN (running ต่อวัน)
 */
export async function generateOrderCode(): Promise<string> {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");
  const datePart = `${y}${m}${d}`;

  const startOfDay = new Date(y, now.getMonth(), now.getDate());
  const endOfDay = new Date(y, now.getMonth(), now.getDate() + 1);

  const count = await prisma.order.count({
    where: { createdAt: { gte: startOfDay, lt: endOfDay } },
  });

  const running = String(count + 1).padStart(4, "0");
  return `ORD-${datePart}-${running}`;
}
