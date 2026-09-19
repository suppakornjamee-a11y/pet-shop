import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { buildPromptPayPayload } from "@/lib/promptpay";
import { buildOrderPlan, persistOrder, type OrderFormData } from "@/lib/order-plan";

/**
 * คำขอจองจาก LINE (ตะกร้า) — ลูกค้าเลือกหลายรายการ แล้วส่งครั้งเดียว แต่ละรายการคือ Order หนึ่งใบ
 * อนุมัติ / แจ้งคิวไม่ว่าง / ชำระมัดจำ ทำทีเดียวทั้งคำขอ
 */

/** รหัสคำขอจอง BK-YYYYMMDD-NNNN (running ต่อวันตามเวลาไทย) */
export async function generateBookingRequestCode(): Promise<string> {
  const datePart = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Bangkok",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  })
    .format(new Date())
    .replace(/-/g, "");
  const prefix = `BK-${datePart}-`;
  const last = await prisma.bookingRequest.findFirst({
    where: { code: { startsWith: prefix } },
    orderBy: { code: "desc" },
    select: { code: true },
  });
  const n = last ? parseInt(last.code.slice(prefix.length), 10) : 0;
  return `${prefix}${String((Number.isNaN(n) ? 0 : n) + 1).padStart(4, "0")}`;
}

/**
 * ยอดที่ต้องจ่ายตอนนี้ของรายการหนึ่ง — อาบน้ำจ่ายเฉพาะมัดจำ (หักจากค่าบริการทั้งหมดตอนสรุปราคาสุทธิ)
 * รายการที่ไม่มีมัดจำ (โรงแรม / บริการอื่น) จ่ายเต็มจำนวนใน QR เดียวกัน
 */
export function amountDueNow(order: { depositAmount: number; total: number }): number {
  return order.depositAmount > 0 ? order.depositAmount : order.total;
}

export async function defaultPromptPayAccount() {
  return (
    (await prisma.bankAccount.findFirst({ where: { type: "PROMPTPAY", active: true, isDefault: true } })) ??
    (await prisma.bankAccount.findFirst({ where: { type: "PROMPTPAY", active: true } }))
  );
}

/** QR ของคำขอจอง — นานกว่าออเดอร์เดี่ยว เพราะลูกค้าเปิดจากข้อความ LINE ทีหลัง ไม่ได้ยืนรออยู่หน้าร้าน */
export const REQUEST_PAYMENT_TTL_MS = 24 * 60 * 60 * 1000;

/** ออก QR ชำระของทั้งคำขอ — ยอด = ผลรวมยอดที่ต้องจ่ายตอนนี้ของทุกรายการที่ยังไม่ยกเลิก */
export async function createRequestPayment(requestId: string) {
  const orders = await prisma.order.findMany({
    where: { bookingRequestId: requestId, status: { not: "CANCELLED" } },
    select: { depositAmount: true, total: true },
  });
  const amount = orders.reduce((sum, o) => sum + amountDueNow(o), 0);
  const account = await defaultPromptPayAccount();
  return prisma.bookingRequestPayment.create({
    data: {
      requestId,
      amount,
      bankAccountId: account?.id ?? null,
      qrPayload: account?.promptpayId ? buildPromptPayPayload(account.promptpayId, amount) : null,
      expiresAt: new Date(Date.now() + REQUEST_PAYMENT_TTL_MS),
    },
  });
}

/* ---------- รายการในตะกร้า ---------- */

export const cartItemSchema = z.object({
  petId: z.string().min(1, "กรุณาเลือกสัตว์เลี้ยง"),
  kind: z.enum(["BATH", "OTHER", "BOARDING"]),
  serviceIds: z.array(z.string()).default([]),
  appointmentDate: z.string().optional(),
  appointmentTime: z.string().optional(),
  roomId: z.string().optional().nullable(),
  checkInDate: z.string().optional(),
  checkInTime: z.string().optional(),
  checkOutDate: z.string().optional(),
  checkOutTime: z.string().optional(),
  nannyType: z.enum(["NONE", "REGULAR", "VIP"]).default("NONE"),
  cctvRequested: z.coerce.boolean().default(false),
  note: z.string().max(500).optional(),
  groomingStyleNote: z.string().max(1000).optional(),
  groomingStyleImages: z.array(z.string()).max(3, "แนบภาพตัวอย่างได้ไม่เกิน 3 รูป").default([]),
});
export type CartItem = z.infer<typeof cartItemSchema>;

/** แปลงรายการในตะกร้าเป็นข้อมูลแผนออเดอร์ชุดเดียวกับที่พนักงานใช้ (ราคา/มัดจำ/เช็คคิวคำนวณที่ server เสมอ) */
export function cartItemToPlanInput(
  item: CartItem,
  customerId: string,
  vaccineComplete: boolean
): OrderFormData {
  const boarding = item.kind === "BOARDING";
  return {
    customerId,
    petId: item.petId,
    roomId: boarding ? item.roomId || null : null,
    checkInDate: boarding ? item.checkInDate : undefined,
    checkInTime: boarding ? item.checkInTime : undefined,
    checkOutDate: boarding ? item.checkOutDate : undefined,
    checkOutTime: boarding ? item.checkOutTime : undefined,
    nannyType: boarding ? item.nannyType : "NONE",
    cctvRequested: boarding ? item.cctvRequested : false,
    depositAmount: 0,
    vaccineComplete,
    note: item.note,
    serviceIds: item.serviceIds,
    productLines: [],
    appointmentDate: boarding ? undefined : item.appointmentDate,
    appointmentTime: boarding ? undefined : item.appointmentTime,
    queueType: item.kind === "OTHER" ? "OTHER" : "BATH",
  };
}

/**
 * สร้างคำขอจอง + ออเดอร์ทุกรายการ (สถานะรอเช็คคิว) — ถ้ารายการไหนไม่ผ่าน (คิวเต็ม ห้องไม่ว่าง ฯลฯ)
 * ลบทุกอย่างที่สร้างไปแล้วทิ้ง ลูกค้าจะได้ไม่มีคำขอครึ่งๆ กลางๆ ค้างอยู่
 * สร้างทีละรายการตามลำดับ รายการหลังจึงเห็นคิวที่รายการก่อนหน้าในคำขอเดียวกันจองไว้แล้ว (ช่วงละ 2 ตัว)
 */
export async function createBookingRequest(
  customerId: string,
  items: CartItem[]
): Promise<{ ok: true; id: string; code: string } | { ok: false; error: string; itemIndex?: number }> {
  const pets = await prisma.pet.findMany({
    where: { id: { in: items.map((i) => i.petId) }, customerId },
    select: { id: true, vaccineComplete: true },
  });
  const petMap = new Map(pets.map((p) => [p.id, p]));
  for (const [i, item] of items.entries()) {
    if (!petMap.has(item.petId)) return { ok: false, error: "ไม่พบสัตว์เลี้ยงนี้ในบัญชีของคุณ", itemIndex: i };
  }

  const request = await prisma.bookingRequest.create({
    data: { code: await generateBookingRequestCode(), customerId },
  });

  const createdOrderIds: string[] = [];
  const rollback = async () => {
    await prisma.order.deleteMany({ where: { id: { in: createdOrderIds } } });
    await prisma.bookingRequest.delete({ where: { id: request.id } }).catch(() => {});
  };

  try {
    for (const [i, item] of items.entries()) {
      const planInput = cartItemToPlanInput(item, customerId, petMap.get(item.petId)?.vaccineComplete ?? false);
      const plan = await buildOrderPlan(planInput);
      if (!plan.ok) {
        await rollback();
        return { ok: false, error: plan.error, itemIndex: i };
      }
      const result = await persistOrder(plan, planInput, {
        createdById: null,
        createdVia: "LIFF",
        bookingRequestId: request.id,
        status: "PENDING_APPROVAL",
        groomingStyleNote: item.kind === "BATH" ? item.groomingStyleNote : null,
        groomingStyleImages: item.kind === "BATH" ? item.groomingStyleImages : [],
      });
      if (!result.ok) {
        await rollback();
        return { ok: false, error: result.error, itemIndex: i };
      }
      createdOrderIds.push(result.id);
    }
  } catch (e) {
    await rollback();
    throw e;
  }

  return { ok: true, id: request.id, code: request.code };
}
