import type { OrderStatus, Role } from "@/generated/prisma/enums";

export type OrderKind = "BOARDING" | "BATH" | "OTHER";

/** จัดประเภทออเดอร์จากฟิลด์ที่มีอยู่แล้ว — ไม่มีฟิลด์ประเภทแยกต่างหาก */
export function getOrderKind(order: { roomId: string | null; queueType: string | null }): OrderKind {
  if (order.roomId != null) return "BOARDING";
  if (order.queueType === "OTHER") return "OTHER";
  return "BATH"; // queueType === "BATH" หรือ null (ออเดอร์เก่าก่อนมีฟีเจอร์นี้)
}

/**
 * สถานะงานอาบน้ำ "ของฉันเอง" ล่าสุด (เริ่มแล้วยังไม่จบ / จบแล้ว) จาก activity log ของออเดอร์
 * ใช้แสดงผลสถานะแบบ personalize ให้ช่างที่ทำเสร็จแล้วเห็น "ทำรายการเสร็จสิ้น" แทนสถานะออเดอร์จริง
 * (log ต้องเรียงจากใหม่ไปเก่า — createdAt desc)
 */
export function getMyGroomerPhase(
  activityLogs: { action: string; createdById: string | null }[],
  userId: string
): { startedNotFinished: boolean; finished: boolean } {
  const mine = activityLogs.find(
    (l) =>
      l.createdById === userId &&
      (l.action.endsWith("เริ่มดำเนินการ") || l.action.endsWith("ทำรายการเสร็จสิ้น"))
  );
  return {
    startedNotFinished: mine?.action.endsWith("เริ่มดำเนินการ") ?? false,
    finished: mine?.action.endsWith("ทำรายการเสร็จสิ้น") ?? false,
  };
}

/** เช็คว่าออเดอร์นี้ (พร้อม payments + extraCharges) ชำระเงินครบยอดหรือยัง */
export function isOrderFullyPaid(order: {
  total: number;
  payments: { status: string; amount: number }[];
  extraCharges: { amount: number }[];
}): boolean {
  const verifiedSum = order.payments
    .filter((p) => p.status === "VERIFIED")
    .reduce((sum, p) => sum + p.amount, 0);
  const amountOwed = order.total + order.extraCharges.reduce((sum, c) => sum + c.amount, 0);
  return verifiedSum >= amountOwed;
}

/**
 * ใครเช็คเอ้าท์ออเดอร์นี้ได้บ้าง (ตาม role + ประเภทออเดอร์) — ใช้ร่วมกันทั้งฝั่ง server action (บังคับสิทธิ์จริง)
 * และฝั่ง UI (ตัดสินใจว่าจะโชว์/บล็อกปุ่ม กับ badge สถานะ) เพื่อไม่ให้ตรรกะสองฝั่งเพี้ยนไปคนละทาง
 */
export function canCheckoutOrder(orderKind: OrderKind, role: Role): boolean {
  if (orderKind === "BOARDING") return role === "ADMIN";
  if (orderKind === "BATH") return role === "ADMIN" || role === "USER";
  return true;
}

/** ใครกด "เริ่มดำเนินการ" ออเดอร์นี้ได้บ้าง (ตาม role + ประเภทออเดอร์) — คู่กับ canCheckoutOrder ด้านบน */
export function canStartOrder(orderKind: OrderKind, role: Role): boolean {
  if (orderKind === "BOARDING") return role === "ADMIN";
  if (orderKind === "BATH") return role === "ADMIN" || role === "GROOMER";
  return true;
}

export type StatusBadgeInfo =
  | { kind: "SLIP_SUBMITTED" }
  | { kind: "GROOMER_FINISHED" }
  | { kind: "BATHING_IN_PROGRESS" }
  | { kind: "AWAITING_PAYMENT" }
  | { kind: "PLAIN"; status: OrderStatus };

/**
 * ตัดสินใจ badge สถานะที่ควรแสดงให้ "ผู้ชมคนนี้" เห็น (personalize ตาม role/สถานะงานของตัวเอง)
 * ใช้ร่วมกันทั้งหน้ารายละเอียดออเดอร์และหน้าปฏิทินคิว กันไม่ให้ขึ้นไม่ตรงกัน
 */
export function getStatusBadgeInfo(
  order: {
    status: OrderStatus;
    roomId: string | null;
    queueType: string | null;
    total: number;
    payments: { status: string; amount: number }[];
    extraCharges: { amount: number }[];
    activityLogs: { action: string; createdById: string | null }[];
  },
  viewer: { id: string; role: Role }
): StatusBadgeInfo {
  // มีสลิปรอตรวจสอบอยู่ ให้ขึ้นก่อนเสมอไม่ว่าสถานะออเดอร์จะเป็นอะไร (ยกเว้นยกเลิกแล้ว) กันสับสนว่าลูกค้าจ่ายหรือยัง
  if (order.status !== "CANCELLED" && order.payments.some((p) => p.status === "SUBMITTED")) {
    return { kind: "SLIP_SUBMITTED" };
  }
  if (order.status !== "IN_PROGRESS") {
    return { kind: "PLAIN", status: order.status };
  }
  const orderKind = getOrderKind(order);

  if (orderKind === "BATH" && viewer.role === "GROOMER") {
    const { finished } = getMyGroomerPhase(order.activityLogs, viewer.id);
    if (finished) return { kind: "GROOMER_FINISHED" };
  }

  // ยังไม่มีช่างคนไหนกด "ทำรายการเสร็จสิ้น" เลย — งานยังอาบน้ำอยู่จริง ห้ามขึ้น "รอลูกค้าชำระเงิน"
  // ก่อนงานเสร็จ (ไม่งั้นพนักงาน/แอดมินจะเข้าใจผิดว่าอาบน้ำเสร็จแล้วทั้งที่ช่างยังไม่กดจบงาน)
  if (orderKind === "BATH" && !order.activityLogs.some((l) => l.action.endsWith("ทำรายการเสร็จสิ้น"))) {
    return { kind: "BATHING_IN_PROGRESS" };
  }

  const showCheckout = canCheckoutOrder(orderKind, viewer.role);
  if (showCheckout && orderKind === "BATH" && !isOrderFullyPaid(order)) {
    return { kind: "AWAITING_PAYMENT" };
  }

  return { kind: "PLAIN", status: order.status };
}
