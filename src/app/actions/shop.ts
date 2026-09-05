"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth-helpers";
import { generateOrderCode } from "@/lib/order-code";
import { buildPromptPayPayload } from "@/lib/promptpay";
import type { ActionResult } from "./customers";

const PAYMENT_TTL_MS = 15 * 60 * 1000; // 15 นาที (เท่ากับ QR ฝั่งงานบริการ)

const shopOrderSchema = z.object({
  items: z
    .array(
      z.object({
        productId: z.string().min(1),
        quantity: z.coerce.number().int().min(1),
      })
    )
    .min(1, "ยังไม่ได้เลือกรายการ"),
  paymentMethod: z.enum(["CASH", "PROMPTPAY"]),
});

async function defaultPromptPayAccount() {
  return (
    (await prisma.bankAccount.findFirst({
      where: { type: "PROMPTPAY", active: true, isDefault: true },
    })) ?? (await prisma.bankAccount.findFirst({ where: { type: "PROMPTPAY", active: true } }))
  );
}

/**
 * เปิดบิลร้านอาหาร/คาเฟ่ — ออเดอร์แบบ SHOP ไม่ผูกลูกค้า (walk-in) และไม่มีคิว/ห้องพัก
 *
 * ราคาทั้งหมดคิดใหม่จากฐานข้อมูลเสมอ ไม่เชื่อตัวเลขที่ส่งมาจากหน้าจอ (กันแก้ราคาฝั่ง client)
 * เงินสด  → บันทึกเป็นชำระแล้วทันที ปิดบิลเป็น COMPLETED พร้อมปริ้นใบเสร็จ
 * พร้อมเพย์ → สร้าง QR ให้ลูกค้าสแกน บิลค้างเป็น PENDING_PAYMENT จนพนักงานยืนยันสลิป
 */
export async function createShopOrder(
  input: unknown
): Promise<ActionResult & { orderId?: string }> {
  const user = await requireUser();
  const parsed = shopOrderSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message };
  const { items, paymentMethod } = parsed.data;

  const products = await prisma.product.findMany({
    where: { id: { in: items.map((i) => i.productId) }, active: true },
  });
  const byId = new Map(products.map((p) => [p.id, p]));

  const lines: { product: (typeof products)[number]; quantity: number; subtotal: number }[] = [];
  for (const item of items) {
    const product = byId.get(item.productId);
    if (!product) return { ok: false, error: "มีสินค้าบางรายการถูกปิดการขายหรือถูกลบไปแล้ว" };
    // ของสัตว์นับสต็อก ของคน (คาเฟ่) ทำสดตามออเดอร์ จึงไม่จำกัดจำนวน
    if (product.target === "PET" && item.quantity > product.stockQty) {
      return {
        ok: false,
        error: `${product.name} มีคงเหลือ ${product.stockQty} ${product.unit} ไม่พอกับที่สั่ง`,
      };
    }
    lines.push({ product, quantity: item.quantity, subtotal: product.price * item.quantity });
  }

  const total = lines.reduce((sum, l) => sum + l.subtotal, 0);
  const isCash = paymentMethod === "CASH";

  const account = isCash ? null : await defaultPromptPayAccount();
  const qrPayload =
    !isCash && account?.promptpayId ? buildPromptPayPayload(account.promptpayId, total) : null;

  const code = await generateOrderCode();

  const order = await prisma.$transaction(async (tx) => {
    const created = await tx.order.create({
      data: {
        code,
        orderType: "SHOP",
        status: isCash ? "COMPLETED" : "PENDING_PAYMENT",
        subtotal: total,
        total,
        createdById: user.id,
        updatedById: user.id,
        items: {
          create: lines.map((l) => ({
            itemType: "PRODUCT" as const,
            refId: l.product.id,
            name: l.product.name,
            unitPrice: l.product.price,
            quantity: l.quantity,
            subtotal: l.subtotal,
          })),
        },
        payments: {
          create: {
            purpose: "BALANCE" as const,
            amount: total,
            method: isCash ? ("CASH" as const) : ("PROMPTPAY" as const),
            status: isCash ? ("VERIFIED" as const) : ("PENDING" as const),
            bankAccountId: account?.id ?? null,
            qrPayload,
            expiresAt: isCash ? null : new Date(Date.now() + PAYMENT_TTL_MS),
            verifiedById: isCash ? user.id : null,
            verifiedAt: isCash ? new Date() : null,
          },
        },
      },
    });

    // ตัดสต็อกเฉพาะของสัตว์ที่นับสต็อกจริง — ตัดตอนเปิดบิลเลยเพราะของถูกหยิบออกจากชั้นแล้ว
    for (const l of lines) {
      if (l.product.target !== "PET") continue;
      await tx.product.update({
        where: { id: l.product.id },
        data: { stockQty: { decrement: l.quantity } },
      });
      await tx.stockMovement.create({
        data: {
          productId: l.product.id,
          type: "OUT",
          quantity: l.quantity,
          reason: `ขายหน้าร้าน ${code}`,
          createdById: user.id,
        },
      });
    }

    return created;
  });

  revalidatePath("/shop");
  revalidatePath("/settings/stock");
  revalidatePath("/orders");
  revalidatePath("/");

  return {
    ok: true,
    message: isCash ? "เปิดบิลและรับเงินเรียบร้อย" : "เปิดบิลเรียบร้อย รอลูกค้าสแกนจ่าย",
    orderId: order.id,
  };
}
