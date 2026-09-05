import nodemailer from "nodemailer";

/**
 * ส่งอีเมลผ่าน SMTP — ตั้งค่าใน .env แบบเดียวกับ LINE คือถ้าไม่ได้ตั้งก็แค่ใช้ฟีเจอร์นี้ไม่ได้
 * ระบบส่วนอื่นทำงานปกติ ไม่พัง
 *
 *   SMTP_HOST=smtp.gmail.com
 *   SMTP_PORT=587
 *   SMTP_USER=อีเมลผู้ส่ง
 *   SMTP_PASS=รหัสผ่านแอป (app password) ไม่ใช่รหัสผ่านอีเมลปกติ
 *   SMTP_FROM="Pawsome Space <no-reply@pawsome.space>"   (ไม่ใส่ = ใช้ SMTP_USER)
 *
 * โหมดทดลอง (MAIL_DEMO=1): ยังไม่มีโดเมน/SMTP จริงก็ทดลองได้ — ใช้ Ethereal ของ nodemailer
 * สร้างกล่องจดหมายจำลองให้อัตโนมัติ อีเมล "ไม่ได้ถูกส่งออกไปจริง" แต่เปิดดูหน้าตาอีเมลได้จากลิงก์พรีวิว
 * เหมาะกับตอนเดโมให้ลูกค้าดู ห้ามเปิดโหมดนี้บนเครื่องจริงที่ต้องส่งถึงลูกค้าจริง
 */
export function isMailDemo() {
  return process.env.MAIL_DEMO === "1";
}

export function isMailConfigured() {
  return (
    isMailDemo() ||
    Boolean(process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS)
  );
}

async function createTransport() {
  if (isMailDemo()) {
    // สร้างบัญชีทดสอบใหม่ทุกครั้ง — Ethereal ไม่ต้องสมัครและไม่ส่งอีเมลออกไปข้างนอกจริง
    const test = await nodemailer.createTestAccount();
    return nodemailer.createTransport({
      host: test.smtp.host,
      port: test.smtp.port,
      secure: test.smtp.secure,
      auth: { user: test.user, pass: test.pass },
    });
  }

  const port = Number(process.env.SMTP_PORT ?? 587);
  return nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port,
    secure: port === 465, // 465 = SSL ตรงๆ, 587 = STARTTLS
    auth: { user: process.env.SMTP_USER!, pass: process.env.SMTP_PASS! },
  });
}

/** ส่งอีเมล — คืน previewUrl เฉพาะตอนอยู่ในโหมดทดลอง (ลิงก์เปิดดูอีเมลที่ Ethereal) */
export async function sendMail(params: {
  to: string;
  subject: string;
  html: string;
}): Promise<{ previewUrl: string | null }> {
  if (!isMailConfigured()) throw new Error("ยังไม่ได้ตั้งค่าอีเมล (SMTP) ในระบบ");
  const transport = await createTransport();
  const info = await transport.sendMail({
    from: process.env.SMTP_FROM || process.env.SMTP_USER || "Pawsome Space <demo@example.com>",
    to: params.to,
    subject: params.subject,
    html: params.html,
  });
  const preview = nodemailer.getTestMessageUrl(info);
  return { previewUrl: typeof preview === "string" ? preview : null };
}
