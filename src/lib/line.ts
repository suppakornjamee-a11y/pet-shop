import crypto from "node:crypto";

/**
 * LINE Messaging API helper — ผูกบัญชีลูกค้าผ่านข้อความ "LINK-<customerId>"
 * และส่ง push message แจ้งเตือนตอนชำระเงินสำเร็จ / งานเสร็จพร้อมรับ
 */

const LINE_API_BASE = "https://api.line.me/v2/bot";

export function isLineConfigured() {
  return Boolean(process.env.LINE_CHANNEL_ACCESS_TOKEN && process.env.LINE_CHANNEL_SECRET);
}

/** สร้างลิงก์/ข้อความสำเร็จรูปสำหรับให้ลูกค้าสแกน เพื่อผูกบัญชี LINE เข้ากับ customerId */
export function buildLineLinkUrl(customerId: string) {
  const basicId = process.env.LINE_OA_BASIC_ID; // เช่น "@123abcde"
  if (!basicId) return null;
  const text = encodeURIComponent(`LINK-${customerId}`);
  return `https://line.me/R/oaMessage/${encodeURIComponent(basicId)}/?${text}`;
}

/** ตรวจลายเซ็น webhook ว่ามาจาก LINE จริง (HMAC-SHA256 ด้วย Channel Secret) */
export function verifyLineSignature(rawBody: string, signature: string | null) {
  const secret = process.env.LINE_CHANNEL_SECRET;
  if (!secret || !signature) return false;
  const hash = crypto.createHmac("sha256", secret).update(rawBody).digest("base64");
  try {
    return crypto.timingSafeEqual(Buffer.from(hash), Buffer.from(signature));
  } catch {
    return false;
  }
}

async function callLineApi(path: string, body: unknown) {
  const token = process.env.LINE_CHANNEL_ACCESS_TOKEN;
  if (!token) return;
  await fetch(`${LINE_API_BASE}${path}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(body),
  });
}

/** ส่งข้อความหาลูกค้าที่ผูก LINE userId ไว้แล้ว (ใช้ตอนแจ้งเตือนอัตโนมัติ) */
export async function sendLinePush(userId: string, text: string) {
  await callLineApi("/message/push", {
    to: userId,
    messages: [{ type: "text", text }],
  });
}

/** ตอบกลับข้อความในบริบทเดิม (ใช้ใน webhook ตอนยืนยันการผูกบัญชี) */
export async function replyLineMessage(replyToken: string, text: string) {
  await callLineApi("/message/reply", {
    replyToken,
    messages: [{ type: "text", text }],
  });
}
