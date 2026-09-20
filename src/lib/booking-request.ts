import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { buildOrderPlan, persistOrder, type OrderFormData } from "@/lib/order-plan";
import type { FleaTickProductInfo } from "@/lib/flea-tick";
import {
  FLEA_GREEN_TEXT,
  FLEA_YELLOW_TEXT,
  assessFleaTick,
  fleaResultText,
  resolveFleaResult,
  validateFleaDeclaration,
  type FleaAnswer,
  type FleaDeclaration,
  type FleaDeclarationError,
  type FleaPetData,
  type FleaResult,
} from "@/lib/flea-tick-check";
import { fleaCheckLog } from "@/lib/order-log";
import { fleaTickWriteData } from "@/lib/pet-quick";
import { formatDateLong } from "@/lib/format";
import { thaiDayRange, toThaiDateStr } from "@/lib/slots";

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
  // คำตอบเรื่องยาเห็บหมัดของงานอาบน้ำ: declare = แจ้งข้อมูลยาใหม่/แก้ไข (พร้อมรูปหลักฐาน), none = ยังไม่ได้ให้ยาใหม่/ไม่แน่ใจ
  flea: z
    .object({
      answer: z.enum(["declare", "none"]),
      medicine: z.string().max(200).default(""),
      productId: z.string().nullable().default(null),
      date: z.string().optional(),
      evidence: z.array(z.string()).max(3, "แนบรูปหลักฐานได้ไม่เกิน 3 รูป").default([]),
    })
    .optional(),
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

type FleaPlan = {
  answer: FleaAnswer | null;
  declaration: FleaDeclaration | null;
  result: FleaResult;
  /** วันครบกำหนดให้ยาครั้งถัดไป (จากข้อมูลที่ใช้ตัดสินจริง) */
  dueDate: string | null;
};

/** รายชื่อยาที่เปิดใช้งาน — หน้าตาเดียวกับที่หน้าจองบน LINE ใช้ (getFleaTickCatalog) */
async function loadFleaCatalog(): Promise<FleaTickProductInfo[]> {
  return prisma.fleaTickProduct.findMany({
    where: { active: true },
    select: {
      id: true,
      name: true,
      formula: true,
      aliases: true,
      species: true,
      form: true,
      tickValue: true,
      tickUnit: true,
      fleaValue: true,
      fleaUnit: true,
      bathNote: true,
      status: true,
    },
  });
}

const FLEA_DECLARATION_ERROR: Record<Exclude<FleaDeclarationError, "DATE_NOT_NEWER">, string> = {
  DATE_UNCHANGED: "เปลี่ยนยาแล้ว กรุณากรอกวันที่ให้ยาครั้งล่าสุดของยาตัวใหม่",
  MEDICINE: "กรุณากรอกชื่อยาเห็บหมัด",
  DATE: "กรุณากรอกวันที่ให้ยาเห็บหมัดครั้งล่าสุด",
  DATE_FUTURE: "วันที่ให้ยาเห็บหมัดต้องไม่เป็นวันในอนาคต",
  DATE_BEFORE_BIRTH: "วันที่ให้ยาเห็บหมัดต้องไม่ก่อนวันเกิดของสัตว์เลี้ยง",
  EVIDENCE: "กรุณาแนบรูปกล่องยาหรือหลักฐานจากคลินิก",
};

const dayLabel = (dateStr: string) => formatDateLong(thaiDayRange(dateStr).start);

/**
 * สร้างคำขอจอง + ออเดอร์ทุกรายการ (สถานะรอเช็คคิว) — ถ้ารายการไหนไม่ผ่าน (คิวเต็ม ห้องไม่ว่าง ฯลฯ)
 * ลบทุกอย่างที่สร้างไปแล้วทิ้ง ลูกค้าจะได้ไม่มีคำขอครึ่งๆ กลางๆ ค้างอยู่
 * สร้างทีละรายการตามลำดับ รายการหลังจึงเห็นคิวที่รายการก่อนหน้าในคำขอเดียวกันจองไว้แล้ว (ช่วงละ 2 ตัว)
 *
 * งานอาบน้ำ: ตรวจข้อมูลยาเห็บหมัดของทุกรายการ "ก่อน" สร้างอะไร (ดู lib/flea-tick-check) — ต้องตอบคำถามให้ครบ
 * คำตอบแบบแจ้งข้อมูลใหม่จะถูกบันทึกลงสัตว์เลี้ยงก่อนสร้างออเดอร์ เพื่อให้ออเดอร์เก็บสำเนาข้อมูลชุดใหม่
 */
export async function createBookingRequest(
  customerId: string,
  items: CartItem[]
): Promise<{ ok: true; id: string; code: string } | { ok: false; error: string; itemIndex?: number }> {
  const pets = await prisma.pet.findMany({
    where: { id: { in: items.map((i) => i.petId) }, customerId },
    select: {
      id: true,
      name: true,
      vaccineComplete: true,
      species: true,
      birthDate: true,
      weightKg: true,
      lastFleaTickAt: true,
      fleaTickMedicine: true,
      fleaTickProductId: true,
    },
  });
  const petMap = new Map(pets.map((p) => [p.id, p]));
  for (const [i, item] of items.entries()) {
    if (!petMap.has(item.petId)) return { ok: false, error: "ไม่พบสัตว์เลี้ยงนี้ในบัญชีของคุณ", itemIndex: i };
  }

  // ตรวจยาเห็บหมัดทุกรายการอาบน้ำก่อนสร้างอะไร — ไม่ผ่านก็ไม่มีอะไรค้าง
  const today = toThaiDateStr(new Date());
  const catalog = items.some((i) => i.kind === "BATH") ? await loadFleaCatalog() : [];
  const fleaPlans = new Map<number, FleaPlan>();
  for (const [i, item] of items.entries()) {
    if (item.kind !== "BATH" || !item.appointmentDate) continue;
    const pet = petMap.get(item.petId)!;
    const stored: FleaPetData = {
      species: pet.species,
      birthDate: pet.birthDate ? toThaiDateStr(pet.birthDate) : null,
      medicine: pet.fleaTickMedicine ?? "",
      productId: pet.fleaTickProductId,
      givenAt: pet.lastFleaTickAt ? toThaiDateStr(pet.lastFleaTickAt) : null,
    };
    const pre = assessFleaTick(stored, catalog, item.appointmentDate, today);
    const answer: FleaAnswer | null = item.flea?.answer ?? null;
    if (pre.level === "ASK" && !answer) {
      return { ok: false, error: `กรุณาตอบข้อมูลยาเห็บหมัดของน้อง${pet.name}`, itemIndex: i };
    }

    let declaration: FleaDeclaration | null = null;
    let post = null;
    if (answer === "declare" && item.flea) {
      declaration = {
        medicine: item.flea.medicine,
        productId: item.flea.productId,
        date: item.flea.date ?? "",
        evidence: item.flea.evidence,
      };
      const error = validateFleaDeclaration({ declaration, pre, stored, catalog, today });
      if (error) {
        const message =
          error === "DATE_NOT_NEWER"
            ? `วันที่ให้ยาครั้งใหม่ต้องหลังวันที่เดิม (${stored.givenAt ? dayLabel(stored.givenAt) : "-"})`
            : FLEA_DECLARATION_ERROR[error];
        return { ok: false, error: `ยาเห็บหมัดของน้อง${pet.name}: ${message}`, itemIndex: i };
      }
      post = assessFleaTick(
        { ...stored, medicine: declaration.medicine, productId: declaration.productId, givenAt: declaration.date },
        catalog,
        item.appointmentDate,
        today
      );
    }
    const result = resolveFleaResult(pre, answer, post);
    fleaPlans.set(i, { answer, declaration, result, dueDate: (post ?? pre).status.nextDueDate });
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

      // ลูกค้าแจ้งข้อมูลยาใหม่ → บันทึกลงสัตว์เลี้ยงก่อนสร้างออเดอร์ (ออเดอร์เก็บสำเนาข้อมูลยา ณ ตอนสร้าง)
      // รูปหลักฐานที่ไม่ได้แนบมาใหม่ไม่ล้างรูปเดิม
      const fleaPlan = fleaPlans.get(i);
      if (fleaPlan?.declaration) {
        const d = fleaPlan.declaration;
        const data = await fleaTickWriteData(prisma, item.petId, {
          fleaTickMedicine: d.medicine,
          fleaTickProductId: d.productId,
          lastFleaTickDate: d.date,
          fleaTickEvidenceUrls: d.evidence.length > 0 ? d.evidence : undefined,
        });
        await prisma.pet.update({ where: { id: item.petId }, data });
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

      // จดผลตรวจยาเห็บหมัดตอนจองลงประวัติ (ระดับเขียว/เหลือง/แดง) — พนักงานเห็นตอนเช็คคิว
      if (fleaPlan) {
        const d = fleaPlan.declaration;
        const due = fleaPlan.dueDate ? ` (ครบกำหนด ${dayLabel(fleaPlan.dueDate)})` : "";
        const declared = d ? ` (${d.medicine.trim() || "ยาที่เลือกจากรายการ"} · ให้เมื่อ ${dayLabel(d.date)})` : "";
        const text =
          fleaPlan.result.level === "GREEN"
            ? `${FLEA_GREEN_TEXT}${due}`
            : fleaPlan.result.level === "YELLOW"
              ? `${FLEA_YELLOW_TEXT}${declared}${due}`
              : `${fleaResultText(fleaPlan.result)}${declared}`;
        await prisma.orderActivityLog.create({
          data: { orderId: result.id, action: fleaCheckLog(fleaPlan.result.level, text) },
        });
      }
    }
  } catch (e) {
    await rollback();
    throw e;
  }

  return { ok: true, id: request.id, code: request.code };
}
