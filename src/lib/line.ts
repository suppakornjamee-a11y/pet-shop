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

/**
 * สร้างลิงก์ deep-link เข้า LIFF app ตรงหน้าที่ต้องการ — LINE รองรับการต่อท้าย path หลัง LIFF ID
 * แล้วพาไปที่ (Endpoint URL ของ LIFF app) + path นั้นทันที ไม่ต้องเปิดจากหน้าแรกของแอปก่อน
 * ใช้ตอนส่ง push message ที่ต้องพาลูกค้ากลับไปหน้าจ่ายเงิน/รายการของตัวเองแบบเจาะจง
 */
export function buildLiffDeepLink(path: string): string | null {
  const liffId = process.env.NEXT_PUBLIC_LINE_LIFF_ID;
  if (!liffId) return null;
  return `https://liff.line.me/${liffId}${path}`;
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
  const res = await fetch(`${LINE_API_BASE}${path}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    throw new Error(`LINE API ${path} failed: ${res.status} ${detail}`);
  }
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

const LINE_VERIFY_URL = "https://api.line.me/oauth2/v2.1/verify";

/**
 * ตรวจสอบ LIFF ID token กับเซิร์ฟเวอร์ของ LINE จริง — ห้ามเชื่อ lineUserId ที่ฝั่ง client
 * (มือถือลูกค้า) ส่งมาตรงๆ เด็ดขาด เพราะปลอมแปลงได้ ฟังก์ชันนี้เป็นด่านแรกของทุกฟังก์ชัน
 * สาธารณะใน src/app/actions/liff.ts คืน userId ที่ยืนยันแล้วจริง หรือ null ถ้า token ไม่ถูกต้อง/หมดอายุ
 */
export async function verifyLiffIdToken(
  idToken: string
): Promise<{ userId: string; name?: string } | null> {
  const liffId = process.env.NEXT_PUBLIC_LINE_LIFF_ID;
  const channelId = liffId?.split("-")[0];
  if (!channelId || !idToken) {
    console.error("[LIFF] verifyLiffIdToken: missing channelId or idToken", { hasLiffId: !!liffId, hasIdToken: !!idToken });
    return null;
  }
  const res = await fetch(LINE_VERIFY_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ id_token: idToken, client_id: channelId }),
  });
  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    console.error("[LIFF] verifyLiffIdToken: LINE verify endpoint rejected token", res.status, detail);
    return null;
  }
  const data = (await res.json()) as { sub?: string; aud?: string; name?: string };
  if (!data.sub || data.aud !== channelId) {
    console.error("[LIFF] verifyLiffIdToken: aud mismatch or missing sub", { expectedChannelId: channelId, aud: data.aud, hasSub: !!data.sub });
    return null;
  }
  return { userId: data.sub, name: data.name };
}
