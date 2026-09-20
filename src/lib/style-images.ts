import { prisma } from "@/lib/prisma";
import { STYLE_IMAGES_PURGED_LOG } from "@/lib/order-log";

/** รูปตัวอย่างทรงขนเก็บไว้ 30 วัน นับจากวันที่ลูกค้าอัปโหลด (ตามที่ร้านกำหนด) */
export const STYLE_IMAGE_TTL_MS = 30 * 24 * 60 * 60 * 1000;

/**
 * ลบรูปตัวอย่างทรงขนที่เก็บมาครบกำหนดแล้ว — เรียกวันละครั้งจาก cron
 * ลบเฉพาะรูป ข้อความทรงที่ลูกค้าพิมพ์ยังอยู่ และบันทึกลงประวัติออเดอร์ว่าลบไปเมื่อไหร่
 *
 * dryRun = true: คืนรายการที่จะลบโดยไม่ลบจริง
 */
export async function purgeExpiredStyleImages({
  now = new Date(),
  dryRun = false,
}: { now?: Date; dryRun?: boolean } = {}): Promise<string[]> {
  const cutoff = new Date(now.getTime() - STYLE_IMAGE_TTL_MS);
  const expired = await prisma.order.findMany({
    where: { groomingStyleImagesAt: { lt: cutoff }, groomingStyleImages: { isEmpty: false } },
    select: { id: true, code: true },
  });
  if (!dryRun) {
    for (const o of expired) {
      await prisma.$transaction([
        prisma.order.update({ where: { id: o.id }, data: { groomingStyleImages: [], groomingStyleImagesAt: null } }),
        prisma.orderActivityLog.create({ data: { orderId: o.id, action: STYLE_IMAGES_PURGED_LOG } }),
      ]);
    }
  }
  return expired.map((o) => o.code);
}
