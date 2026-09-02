import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { buildSlotDate, daysBetween, isValidDateStr, isValidTimeStr, thaiDayRange } from "@/lib/slots";
import { isSlotAvailable } from "@/lib/booking";
import { isRoomAvailable } from "@/lib/room-availability";
import { generateOrderCode } from "@/lib/order-code";
import type { RoomModel, RoomCategoryModel } from "@/generated/prisma/models";
import type { CreationChannel } from "@/generated/prisma/enums";

// ตรรกะคำนวณราคา + ตรวจสอบคิว/ห้องว่าง ใช้ร่วมกันทั้งฝั่งพนักงาน (src/app/actions/orders.ts)
// และฝั่งลูกค้าเองผ่าน LINE LIFF (src/app/actions/liff.ts) — ห้ามแยกกฎเป็นคนละชุด
// (ย้ายมาจาก orders.ts เดิมทั้งหมด ไม่เปลี่ยนพฤติกรรม)

const BATH_DEPOSIT_AMOUNT = 300; // มัดจำจองอาบน้ำ บังคับ 300 ต่อตัว (ต่อออเดอร์ เพราะจองทีละตัว)
const NANNY_REGULAR_RATE = 300; // พี่เลี้ยงดูแลพิเศษ ต่อคืนต่อตัว
const NANNY_VIP_RATE = 400; // พี่เลี้ยงดูแลพิเศษ VIP ต่อตัวต่อการเข้าพัก (ไม่คูณจำนวนคืน)
const CCTV_ROOM_RATE = 100; // ห้องกล้องวงจรปิด

export const createOrderSchema = z.object({
  customerId: z.string().min(1, "กรุณาเลือกลูกค้า"),
  petId: z.string().optional().nullable(),
  roomId: z.string().optional().nullable(),
  checkInDate: z.string().optional(),
  checkInTime: z.string().optional(),
  checkOutDate: z.string().optional(),
  checkOutTime: z.string().optional(),
  nannyType: z.enum(["NONE", "REGULAR", "VIP"]).default("NONE"),
  cctvRequested: z.coerce.boolean().default(false),
  depositAmount: z.coerce.number().int().min(0).default(0),
  vaccineComplete: z.coerce.boolean().default(false),
  lastFleaTickDate: z.string().optional(),
  fleaTickMedicine: z.string().optional(),
  note: z.string().optional(),
  serviceIds: z.array(z.string()).default([]),
  productLines: z
    .array(z.object({ productId: z.string(), quantity: z.coerce.number().int().min(1) }))
    .default([]),
  appointmentDate: z.string().optional(),
  appointmentTime: z.string().optional(),
  queueType: z.enum(["BATH", "OTHER"]).default("BATH"),
});

export type OrderFormData = z.infer<typeof createOrderSchema>;

export type OrderItemInput = {
  itemType: "SERVICE" | "ROOM" | "PRODUCT";
  refId: string;
  name: string;
  unitPrice: number;
  quantity: number;
  subtotal: number;
};

type RoomWithCategory = RoomModel & { category: RoomCategoryModel };

/**
 * ประมวลผล + ตรวจสอบข้อมูลฟอร์มออเดอร์ทั้งหมด (ใช้ร่วมกันทั้งสร้างและแก้ไข)
 * - ถ้ามีบริการอาบน้ำ/ตัดขน (คิวส่วนกลาง) หรือไม่มีห้อง → ต้องเลือกคิวจากปฏิทิน
 * - ถ้ามีห้อง → ต้องระบุวัน-เวลาเช็คอิน/เช็คเอาท์ และห้องต้องว่างในช่วงนั้น
 */
export async function buildOrderPlan(
  data: OrderFormData,
  excludeOrderId?: string
): Promise<
  | {
      ok: true;
      appointmentAt: Date | null;
      checkInAt: Date | null;
      checkOutAt: Date | null;
      nights: number;
      items: OrderItemInput[];
      subtotal: number;
      depositAmount: number;
      holidaySurcharge: number;
      holidayLabel: string | null;
      room: NonNullable<RoomWithCategory>;
    }
  | {
      ok: true;
      room: null;
      appointmentAt: Date | null;
      checkInAt: null;
      checkOutAt: null;
      nights: 0;
      items: OrderItemInput[];
      subtotal: number;
      depositAmount: number;
      holidaySurcharge: number;
      holidayLabel: string | null;
    }
  | { ok: false; error: string }
> {
  const hasSomething =
    data.serviceIds.length > 0 || data.productLines.length > 0 || !!data.roomId;
  if (!hasSomething) {
    return { ok: false, error: "กรุณาเพิ่มบริการ ห้องพัก หรือสินค้าอย่างน้อย 1 รายการ" };
  }

  const [services, room, products] = await Promise.all([
    data.serviceIds.length
      ? prisma.service.findMany({ where: { id: { in: data.serviceIds } } })
      : Promise.resolve([]),
    data.roomId
      ? prisma.room.findUnique({ where: { id: data.roomId }, include: { category: true } })
      : Promise.resolve(null),
    data.productLines.length
      ? prisma.product.findMany({ where: { id: { in: data.productLines.map((p) => p.productId) } } })
      : Promise.resolve([]),
  ]);

  // ถ้ามีห้อง ใช้เวลาเช็คอิน/เช็คเอาท์เป็นตัวอ้างอิงแทนคิวส่วนกลาง — แม้จะมีบริการอาบน้ำ/ตัดขนติดมาด้วยก็ไม่ต้องเลือกคิวซ้ำ
  const needsAppointment = !room;

  let appointmentAt: Date | null = null;
  if (needsAppointment) {
    const { appointmentDate, appointmentTime } = data;
    if (
      !appointmentDate ||
      !appointmentTime ||
      !isValidDateStr(appointmentDate) ||
      !isValidTimeStr(appointmentTime)
    ) {
      return { ok: false, error: "กรุณาเลือกวันและเวลาคิวจากปฏิทินก่อนสร้างออเดอร์" };
    }
    appointmentAt = buildSlotDate(appointmentDate, appointmentTime);
    if (appointmentAt.getTime() < Date.now()) {
      return { ok: false, error: "ไม่สามารถจองคิวย้อนหลังได้ กรุณาเลือกเวลาในอนาคต" };
    }
    if (!(await isSlotAvailable(appointmentDate, appointmentTime, excludeOrderId, data.queueType))) {
      return { ok: false, error: "ช่วงเวลานี้มีคิวแล้ว กรุณาเลือกช่วงเวลาอื่น" };
    }
  }

  let checkInAt: Date | null = null;
  let checkOutAt: Date | null = null;
  let nights = 0;
  if (room) {
    const { checkInDate, checkInTime, checkOutDate, checkOutTime } = data;
    if (
      !checkInDate ||
      !checkInTime ||
      !checkOutDate ||
      !checkOutTime ||
      !isValidDateStr(checkInDate) ||
      !isValidTimeStr(checkInTime) ||
      !isValidDateStr(checkOutDate) ||
      !isValidTimeStr(checkOutTime)
    ) {
      return { ok: false, error: "กรุณาระบุวัน-เวลาเช็คอินและเช็คเอาท์ของห้อง/พื้นที่" };
    }
    checkInAt = buildSlotDate(checkInDate, checkInTime);
    checkOutAt = buildSlotDate(checkOutDate, checkOutTime);
    if (checkOutAt.getTime() <= checkInAt.getTime()) {
      return { ok: false, error: "เวลาเช็คเอาท์ต้องอยู่หลังเวลาเช็คอิน" };
    }
    // ห้องรายครั้ง (Daycare/Pawsome) ปกติเช็คอิน-เอาท์วันเดียวกัน คิด "1 ครั้ง" — แต่ถ้าจองข้ามวัน
    // (เปิดให้ทำได้แล้ว) ให้คิดราคาเหมือนห้องรายคืนทั่วไป (ราคาต่อคืน × จำนวนคืน) กันคิดเงินขาด
    nights =
      room.category.billingUnit === "PER_NIGHT" || checkInDate !== checkOutDate
        ? Math.max(1, daysBetween(checkInDate, checkOutDate))
        : 0;
    if (!(await isRoomAvailable(room.id, checkInAt, checkOutAt, excludeOrderId))) {
      return { ok: false, error: "ห้อง/พื้นที่นี้ถูกจองในช่วงเวลาดังกล่าวแล้ว กรุณาเลือกห้องหรือช่วงเวลาอื่น" };
    }
  }

  const items: OrderItemInput[] = [];
  for (const s of services) {
    items.push({
      itemType: "SERVICE",
      refId: s.id,
      name: s.name,
      unitPrice: s.price,
      quantity: 1,
      subtotal: s.price,
    });
  }
  if (room) {
    const qty = nights > 0 ? nights : 1;
    const unitLabel = nights > 0 ? `${nights} คืน` : "1 ครั้ง";
    items.push({
      itemType: "ROOM",
      refId: room.id,
      name: `${room.category.name} ${room.name} (${unitLabel})`,
      unitPrice: room.pricePerNight,
      quantity: qty,
      subtotal: room.pricePerNight * qty,
    });
    if (data.nannyType === "REGULAR") {
      items.push({
        itemType: "SERVICE",
        refId: "nanny-regular",
        name: `พี่เลี้ยงดูแลพิเศษ (${qty} คืน)`,
        unitPrice: NANNY_REGULAR_RATE,
        quantity: qty,
        subtotal: NANNY_REGULAR_RATE * qty,
      });
    } else if (data.nannyType === "VIP") {
      items.push({
        itemType: "SERVICE",
        refId: "nanny-vip",
        name: "พี่เลี้ยงดูแลพิเศษ VIP",
        unitPrice: NANNY_VIP_RATE,
        quantity: 1,
        subtotal: NANNY_VIP_RATE,
      });
    }
    if (data.cctvRequested) {
      items.push({
        itemType: "SERVICE",
        refId: "cctv-room",
        name: "ห้องกล้องวงจรปิด",
        unitPrice: CCTV_ROOM_RATE,
        quantity: 1,
        subtotal: CCTV_ROOM_RATE,
      });
    }
  }
  for (const line of data.productLines) {
    const p = products.find((x) => x.id === line.productId);
    if (!p) continue;
    items.push({
      itemType: "PRODUCT",
      refId: p.id,
      name: p.name,
      unitPrice: p.price,
      quantity: line.quantity,
      subtotal: p.price * line.quantity,
    });
  }

  const subtotal = items.reduce((sum, it) => sum + it.subtotal, 0);

  // นโยบายมัดจำ: ห้องพัก/บริการอื่นๆ ไม่มีมัดจำ (จ่ายเต็มจำนวนเสมอ) — จองอาบน้ำบังคับมัดจำ 300 ต่อออเดอร์เสมอ
  const depositAmount = room
    ? 0
    : data.queueType === "BATH"
      ? Math.min(BATH_DEPOSIT_AMOUNT, subtotal)
      : 0;

  // ค่าธรรมเนียมวันหยุด — อิงวันที่ให้บริการจริง (เช็คอิน ถ้ามีห้อง, ไม่งั้นใช้วันนัดคิว)
  const serviceDateStr = room ? data.checkInDate : data.appointmentDate;
  let holidaySurcharge = 0;
  let holidayLabel: string | null = null;
  if (serviceDateStr && isValidDateStr(serviceDateStr)) {
    const holiday = await prisma.holiday.findUnique({
      where: { date: thaiDayRange(serviceDateStr).start },
    });
    if (holiday) {
      holidaySurcharge = holiday.extraCharge;
      holidayLabel = holiday.title;
    }
  }

  if (room) {
    return {
      ok: true,
      appointmentAt,
      checkInAt,
      checkOutAt,
      nights,
      items,
      subtotal,
      depositAmount,
      holidaySurcharge,
      holidayLabel,
      room,
    };
  }
  return {
    ok: true,
    appointmentAt,
    checkInAt: null,
    checkOutAt: null,
    nights: 0,
    items,
    subtotal,
    depositAmount,
    holidaySurcharge,
    holidayLabel,
    room: null,
  };
}

type OrderPlanOk = Extract<Awaited<ReturnType<typeof buildOrderPlan>>, { ok: true }>;

export function parseFleaTickDate(dateStr: string | undefined): Date | null {
  return dateStr && isValidDateStr(dateStr) ? buildSlotDate(dateStr, "00:00") : null;
}

/**
 * สร้าง Order row จริงพร้อม retry เผื่อรหัสชนกัน + snapshot ข้อมูลวัคซีน/เห็บหมัดลงตัวสัตว์เลี้ยง
 * ใช้ร่วมกันทั้งฝั่งพนักงาน (createOrder) และฝั่งลูกค้า (liffCreateOrder) — ผู้เรียกไปเรียก
 * createInitialPayments(...) เองต่อ (อยู่ใน orders.ts เพราะเกี่ยวกับ payment/QR โดยตรง)
 */
export async function persistOrder(
  plan: OrderPlanOk,
  data: OrderFormData,
  meta: { createdById: string | null; createdVia: CreationChannel }
): Promise<{ ok: true; id: string; total: number } | { ok: false; error: string }> {
  const total = plan.subtotal + plan.holidaySurcharge;
  const lastFleaTickAt = parseFleaTickDate(data.lastFleaTickDate);

  let order: { id: string } | null = null;
  for (let attempt = 0; attempt < 5; attempt++) {
    const code = await generateOrderCode();
    try {
      order = await prisma.order.create({
        data: {
          code,
          customerId: data.customerId,
          petId: data.petId || null,
          roomId: plan.room?.id ?? null,
          nights: plan.nights,
          appointmentAt: plan.appointmentAt,
          queueType: plan.appointmentAt ? data.queueType : null,
          checkInAt: plan.checkInAt,
          checkOutAt: plan.checkOutAt,
          nannyType: data.nannyType,
          cctvRequested: data.cctvRequested,
          depositAmount: plan.depositAmount,
          holidaySurcharge: plan.holidaySurcharge,
          holidayLabel: plan.holidayLabel,
          vaccineComplete: data.vaccineComplete,
          lastFleaTickAt,
          fleaTickMedicine: data.fleaTickMedicine || null,
          subtotal: plan.subtotal,
          total,
          note: data.note || null,
          createdById: meta.createdById,
          updatedById: meta.createdById,
          createdVia: meta.createdVia,
          status: "PENDING_PAYMENT",
          items: { create: plan.items },
        },
      });
      break;
    } catch (e) {
      const isDup = (e as { code?: string })?.code === "P2002";
      if (isDup && attempt < 4) continue; // รหัสชน — สร้างเลขใหม่แล้วลองอีก
      throw e;
    }
  }
  if (!order) return { ok: false, error: "สร้างออเดอร์ไม่สำเร็จ กรุณาลองใหม่" };

  if (data.petId) {
    await prisma.pet.update({
      where: { id: data.petId },
      data: {
        vaccineComplete: data.vaccineComplete,
        lastFleaTickAt,
        fleaTickMedicine: data.fleaTickMedicine || null,
      },
    });
  }

  return { ok: true, id: order.id, total };
}
