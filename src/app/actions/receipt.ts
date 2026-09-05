"use server";

import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth-helpers";
import { getShopInfo } from "@/lib/settings";
import { formatBaht, formatDateTime } from "@/lib/format";
import { isMailConfigured, isMailDemo, sendMail } from "@/lib/mail";
import type { ActionResult } from "./customers";

const schema = z.object({
  orderId: z.string().min(1),
  email: z.string().email("อีเมลไม่ถูกต้อง"),
});

/** ใบเสร็จเวอร์ชันอีเมล — เขียนเป็น HTML แบบตารางล้วน เพราะโปรแกรมอ่านอีเมลส่วนใหญ่ไม่รองรับ CSS สมัยใหม่ */
function buildReceiptHtml(params: {
  shop: { name: string; address: string; taxId: string; lineId: string; phone: string };
  code: string;
  createdAt: Date;
  customerName: string;
  items: { name: string; quantity: number; unitPrice: number; subtotal: number }[];
  extraCharges: { description: string; amount: number }[];
  holidaySurcharge: number;
  holidayLabel: string | null;
  total: number;
}) {
  const { shop } = params;
  const row = (left: string, right: string, bold = false) =>
    `<tr>
       <td style="padding:6px 0;${bold ? "font-weight:700;" : ""}">${left}</td>
       <td style="padding:6px 0;text-align:right;${bold ? "font-weight:700;" : ""}">${right}</td>
     </tr>`;

  const itemRows = params.items
    .map((it) =>
      row(
        `${escapeHtml(it.name)} <span style="color:#71717a">x${it.quantity}</span>`,
        formatBaht(it.subtotal)
      )
    )
    .join("");
  const extraRows = params.extraCharges
    .map((c) => row(escapeHtml(c.description), formatBaht(c.amount)))
    .join("");
  const holidayRow =
    params.holidaySurcharge > 0
      ? row(
          `ค่าบริการวันหยุด${params.holidayLabel ? ` (${escapeHtml(params.holidayLabel)})` : ""}`,
          `+${formatBaht(params.holidaySurcharge)}`
        )
      : "";

  return `<div style="font-family:system-ui,-apple-system,'Segoe UI',sans-serif;max-width:520px;margin:0 auto;color:#18181b">
  <div style="text-align:center;padding-bottom:16px;border-bottom:1px solid #e4e4e7">
    <div style="font-size:20px;font-weight:700">${escapeHtml(shop.name)}</div>
    ${shop.address ? `<div style="font-size:12px;color:#71717a;margin-top:4px;white-space:pre-line">${escapeHtml(shop.address)}</div>` : ""}
    ${shop.taxId ? `<div style="font-size:12px;color:#71717a">TAX ID: ${escapeHtml(shop.taxId)}</div>` : ""}
    ${shop.phone ? `<div style="font-size:12px;color:#71717a">${escapeHtml(shop.phone)}</div>` : ""}
  </div>

  <table style="width:100%;border-collapse:collapse;font-size:13px;margin-top:16px">
    ${row("เลขที่", escapeHtml(params.code))}
    ${row("วันที่", formatDateTime(params.createdAt))}
    ${row("ลูกค้า", escapeHtml(params.customerName))}
  </table>

  <table style="width:100%;border-collapse:collapse;font-size:13px;margin-top:16px;border-top:1px solid #e4e4e7">
    ${itemRows}${extraRows}${holidayRow}
  </table>

  <table style="width:100%;border-collapse:collapse;font-size:16px;margin-top:8px;border-top:2px solid #18181b">
    ${row("ยอดรวมทั้งสิ้น", formatBaht(params.total), true)}
  </table>

  <div style="text-align:center;font-size:12px;color:#a1a1aa;margin-top:24px">
    ขอบคุณที่ใช้บริการ
    ${shop.lineId ? `<div style="margin-top:4px">LINE: ${escapeHtml(shop.lineId)}</div>` : ""}
  </div>
</div>`;
}

function escapeHtml(s: string) {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/** ส่งใบเสร็จเข้าอีเมลลูกค้า */
export async function emailReceipt(
  input: unknown
): Promise<ActionResult & { previewUrl?: string }> {
  await requireUser();
  if (!isMailConfigured()) {
    return { ok: false, error: "ยังไม่ได้ตั้งค่าอีเมล (SMTP) ในระบบ — ติดต่อผู้ดูแลระบบ" };
  }
  const parsed = schema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message };
  const { orderId, email } = parsed.data;

  const order = await prisma.order.findUnique({
    where: { id: orderId },
    include: { customer: true, items: true, extraCharges: true },
  });
  if (!order) return { ok: false, error: "ไม่พบออเดอร์" };

  const shop = await getShopInfo();
  const extraChargesTotal = order.extraCharges.reduce((sum, c) => sum + c.amount, 0);

  const html = buildReceiptHtml({
    shop,
    code: order.code,
    createdAt: order.createdAt,
    customerName: order.customer?.name ?? "ลูกค้าหน้าร้าน",
    items: order.items,
    extraCharges: order.extraCharges,
    holidaySurcharge: order.holidaySurcharge,
    holidayLabel: order.holidayLabel,
    total: order.total + extraChargesTotal,
  });

  let previewUrl: string | null = null;
  try {
    ({ previewUrl } = await sendMail({
      to: email,
      subject: `ใบเสร็จรับเงิน ${order.code} · ${shop.name}`,
      html,
    }));
  } catch (e) {
    console.error("[receipt] ส่งอีเมลไม่สำเร็จ:", e);
    return { ok: false, error: "ส่งอีเมลไม่สำเร็จ ลองใหม่อีกครั้ง" };
  }

  if (isMailDemo()) {
    return {
      ok: true,
      message: "โหมดทดลอง — อีเมลไม่ได้ถูกส่งจริง กดดูตัวอย่างใบเสร็จได้",
      previewUrl: previewUrl ?? undefined,
    };
  }
  return { ok: true, message: `ส่งใบเสร็จไปที่ ${email} แล้ว` };
}
