import { NextResponse } from "next/server";
import { runStayReminders } from "@/lib/stay-reminders";

/**
 * งานรายวันจาก Vercel Cron (ตั้งเวลาไว้ใน vercel.json) — ส่ง LINE คอนเฟิร์มเช็คอิน/เช็คเอาท์ล่วงหน้า 1 วัน
 *
 * Vercel แนบ "Authorization: Bearer <CRON_SECRET>" มาให้เองเมื่อตั้ง CRON_SECRET ไว้ใน Environment Variables
 * ถ้ายังไม่ได้ตั้ง จะปฏิเสธทุกคำขอ — กันคนนอกเรียก URL นี้ซ้ำๆ จนลูกค้าโดนข้อความ/โควตา LINE หมด
 *
 * ?dryRun=1 ดูรายการที่จะส่งโดยไม่ส่งจริง (ยังต้องแนบ secret เหมือนกัน)
 */
export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const dryRun = new URL(request.url).searchParams.get("dryRun") === "1";
  const results = await runStayReminders({ dryRun });
  return NextResponse.json({ dryRun, count: results.length, results });
}
