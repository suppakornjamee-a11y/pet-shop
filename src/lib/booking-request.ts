import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { buildOrderPlan, persistOrder, type OrderFormData } from "@/lib/order-plan";
import { computeFleaTickStatus } from "@/lib/flea-tick";
import { formatDateLong } from "@/lib/format";
import { thaiDayRange } from "@/lib/slots";

/**
 * คำขอจองจาก LINE (ตะกร้า) — ลูกค้าเลือกหลายรายการ แล้วส่งครั้งเดียว แต่ละรายการคือ Order หนึ่งใบ
 * แอดมินอนุมัติ / แจ้งคิวไม่ว่าง ทีละรายการ และลูกค้าชำระแยกตามรายการ (หน้าชำระเงินเดิมของออเดอร์)
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

/** QR ของรายการในคำขอจอง — 30 นาทีนับจากแอดมินอนุมัติคิว (ร้านกำหนด) */
export const REQUEST_PAYMENT_TTL_MS = 30 * 60 * 1000;

/**
 * สถานะรวมของคำขอจอง คำนวณจากสถานะของแต่ละรายการ (แอดมินอนุมัติ/แจ้งคิวไม่ว่างทีละรายการ)
 * เรียกทุกครั้งหลังรายการในคำขอเปลี่ยนสถานะ หรือมีการส่ง/ตรวจสลิป
 * ลำดับ: มีรายการรอเลือกวันใหม่ → รอเลือกวันเวลาใหม่ / มีรายการรอตรวจคิว → รอตรวจสอบคิว /
 * มีรายการรอชำระ → รอชำระมัดจำ (ถ้าทุกรายการที่รอชำระส่งสลิปแล้ว → รอตรวจสอบมัดจำ) / ยกเลิกหมด → ยกเลิก / นอกนั้น → ยืนยันแล้ว
 */
export async function syncBookingRequestStatus(requestId: string) {
  const orders = await prisma.order.findMany({
    where: { bookingRequestId: requestId },
    select: {
      status: true,
      payments: { orderBy: { createdAt: "desc" }, take: 1, select: { status: true } },
    },
  });
  if (orders.length === 0) return;
  const live = orders.filter((o) => o.status !== "CANCELLED");
  const awaitingPayment = live.filter((o) => o.status === "PENDING_PAYMENT");
  const status =
    live.length === 0
      ? "CANCELLED"
      : live.some((o) => o.status === "RESCHEDULE_REQUIRED")
        ? "NEEDS_RESCHEDULE"
        : live.some((o) => o.status === "PENDING_APPROVAL")
          ? "PENDING_APPROVAL"
          : awaitingPayment.length > 0
            ? awaitingPayment.every((o) => o.payments[0]?.status === "SUBMITTED")
              ? "DEPOSIT_SUBMITTED"
              : "PENDING_DEPOSIT"
            : "CONFIRMED";
  await prisma.bookingRequest.update({ where: { id: requestId }, data: { status } });
}

/** เรียกจากจุดที่รู้แค่ออเดอร์ — ออเดอร์ที่ไม่ได้อยู่ในคำขอจองไม่ทำอะไร */
export async function syncBookingRequestForOrder(orderId: string) {
  const order = await prisma.order.findUnique({ where: { id: orderId }, select: { bookingRequestId: true } });
  if (order?.bookingRequestId) await syncBookingRequestStatus(order.bookingRequestId);
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
  // ลูกค้ายืนยันข้อมูลสัตว์เลี้ยงเดิม (SAME) หรืออัปเดตข้อมูล (UPDATED) ก่อนจองอาบน้ำ — จดลงประวัติออเดอร์
  petInfo: z.enum(["NEW", "SAME", "UPDATED"]).optional(),
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
    select: { id: true, vaccineComplete: true, species: true, weightKg: true, lastFleaTickAt: true, fleaTickProduct: true },
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

      if (item.kind === "BATH" && (item.petInfo === "SAME" || item.petInfo === "UPDATED")) {
        const weight = petMap.get(item.petId)?.weightKg;
        await prisma.orderActivityLog.create({
          data: {
            orderId: result.id,
            action: `${
              item.petInfo === "SAME" ? "ลูกค้ายืนยันว่าข้อมูลสัตว์เลี้ยงเดิมยังถูกต้อง" : "ลูกค้าอัปเดตข้อมูลสัตว์เลี้ยงก่อนจอง"
            }${weight ? ` (น้ำหนัก ${weight} กก.)` : ""}`,
          },
        });
      }

      // จดสถานะยาเห็บหมัดตอนที่ลูกค้าจอง (เทียบกับวันบริการ) ไว้ในประวัติ — พนักงานตรวจซ้ำตอนเช็คคิว
      if (item.kind === "BATH" && item.appointmentDate) {
        const pet = petMap.get(item.petId)!;
        const status = computeFleaTickStatus({
          givenAt: pet.lastFleaTickAt,
          product: pet.fleaTickProduct,
          petSpecies: pet.species,
          serviceDate: item.appointmentDate,
        });
        const due = status.nextDueDate ? ` (ครบกำหนด ${formatDateLong(thaiDayRange(status.nextDueDate).start)})` : "";
        const text =
          status.kind === "COVERED"
            ? `อยู่ในช่วงตามข้อมูลที่ลูกค้าแจ้ง${due}`
            : status.kind === "DUE_BEFORE_SERVICE"
              ? `ถึงกำหนดก่อนวันบริการ${due}`
              : "ข้อมูลไม่ครบหรือรอตรวจสอบ";
        await prisma.orderActivityLog.create({
          data: { orderId: result.id, action: `ตรวจยาเห็บหมัดตอนจอง: ${text}` },
        });
      }
    }
  } catch (e) {
    await rollback();
    throw e;
  }

  return { ok: true, id: request.id, code: request.code };
}
