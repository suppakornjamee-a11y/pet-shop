import { NextResponse } from "next/server";
import { runStayReminders } from "@/lib/stay-reminders";
import { runAppointmentReminders } from "@/lib/appointment-reminders";
import { purgeExpiredStyleImages } from "@/lib/style-images";

/**
 * งานรายวันจาก Vercel Cron (ตั้งเวลาไว้ใน vercel.json)
 * - ส่ง LINE คอนเฟิร์มเช็คอิน/เช็คเอาท์โรงแรมล่วงหน้า 1 วัน
 * - ส่ง LINE เตือนนัดอาบน้ำ/บริการอื่นล่วงหน้า 1 วัน (เฉพาะรายการที่ยืนยันแล้ว)
 * - ลบรูปตัวอย่างทรงขนที่เก็บครบ 30 วัน
 *
 * Vercel แนบ "Authorization: Bearer <CRON_SECRET>" มาให้เองเมื่อตั้ง CRON_SECRET ไว้ใน Environment Variables
 * ถ้ายังไม่ได้ตั้ง จะปฏิเสธทุกคำขอ — กันคนนอกเรียก URL นี้ซ้ำๆ จนลูกค้าโดนข้อความ/โควตา LINE หมด
 *
 * ?dryRun=1 ดูรายการที่จะทำโดยไม่ทำจริง (ยังต้องแนบ secret เหมือนกัน)
 */
export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const dryRun = new URL(request.url).searchParams.get("dryRun") === "1";

  // งานหนึ่งพัง ไม่ให้ลากอีกสองงานที่เหลือพังตาม
  async function run<T>(job: () => Promise<T>): Promise<{ ok: true; result: T } | { ok: false; error: string }> {
    try {
      return { ok: true, result: await job() };
    } catch (e) {
      console.error("[cron/daily] job failed:", e);
      return { ok: false, error: e instanceof Error ? e.message : String(e) };
    }
  }

  const [stay, appointments, styleImages] = await Promise.all([
    run(() => runStayReminders({ dryRun })),
    run(() => runAppointmentReminders({ dryRun })),
    run(() => purgeExpiredStyleImages({ dryRun })),
  ]);
  return NextResponse.json({ dryRun, stay, appointments, styleImages });
}
