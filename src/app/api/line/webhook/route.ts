import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyLineSignature, replyLineMessage } from "@/lib/line";

type LineEvent = {
  type: string;
  replyToken?: string;
  source?: { userId?: string };
  message?: { type: string; text?: string };
};

/**
 * Webhook รับ event จาก LINE OA — ใช้ผูก LINE userId เข้ากับลูกค้าในระบบ
 * เมื่อลูกค้าส่งข้อความรูปแบบ "LINK-<customerId>" (มาจากลิงก์/QR ที่สร้างในหน้าโปรไฟล์ลูกค้า)
 */
export async function POST(request: Request) {
  const rawBody = await request.text();
  const signature = request.headers.get("x-line-signature");

  if (!verifyLineSignature(rawBody, signature)) {
    return NextResponse.json({ error: "invalid signature" }, { status: 401 });
  }

  const body = JSON.parse(rawBody) as { events?: LineEvent[] };

  for (const event of body.events ?? []) {
    if (event.type !== "message" || event.message?.type !== "text") continue;

    const text = event.message.text ?? "";
    const userId = event.source?.userId;
    const replyToken = event.replyToken;
    if (!text.startsWith("LINK-") || !userId) continue;

    const customerId = text.slice("LINK-".length).trim();
    const customer = await prisma.customer.findUnique({ where: { id: customerId } });

    if (!customer) {
      if (replyToken) await replyLineMessage(replyToken, "ไม่พบข้อมูลลูกค้า กรุณาสแกน QR จากหน้าโปรไฟล์อีกครั้ง");
      continue;
    }

    await prisma.customer.update({ where: { id: customerId }, data: { lineUserId: userId } });
    if (replyToken) {
      await replyLineMessage(replyToken, `เชื่อมต่อบัญชี LINE สำเร็จแล้ว ✅ (${customer.name})`);
    }
  }

  return NextResponse.json({ ok: true });
}
