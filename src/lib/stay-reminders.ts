import { prisma } from "@/lib/prisma";
import { formatDateLong } from "@/lib/format";
import { sendLinePush } from "@/lib/line";
import { CHECKIN_REMINDER_LOG, CHECKOUT_REMINDER_LOG } from "@/lib/order-log";
import { addDaysThai, thaiDayRange, toThaiDateStr } from "@/lib/slots";

/** ข้อความตามที่ร้านกำหนด — แก้ถ้อยคำที่นี่ที่เดียว */
export function checkInReminderText(checkInDate: string): string {
  return `สวัสดีค่ะ ☀️
Pawsome ขอแจ้งเตือนเพื่อคอนเฟิร์มการเข้าพักของน้องในวันพรุ่งนี้นะคะ
📍 วันเช็กอิน: ${checkInDate}
และขอความกรุณาแจ้ง 🕑 เวลาที่จะนำน้องเข้าพัก

เพื่อที่ทีมจะได้เตรียมต้อนรับอย่างดีที่สุดค่ะ 🐶🐱
ขอบคุณที่ไว้วางใจให้เราดูแลน้องนะคะ 💛

🚿 หากต้องการให้น้องอาบน้ำ ระหว่างการเข้าพัก หรือ ภายในวันเช็คเอ้าท์ รบกวนแจ้งล่วงหน้าเพื่อให้ทางร้านนัดคิวให้ค่ะ 🙏🏻`;
}

export function checkOutReminderText(checkOutDate: string): string {
  return `แจ้งเตือนวันเช็กเอาต์ของน้องนะคะ ☁️
พรุ่งนี้น้องจะเช็กเอาต์ออกจาก Pawsome แล้วค่ะ
📍 วันเช็กเอาต์: ${checkOutDate}
ขอความกรุณาแจ้ง⏰เวลาที่จะมารับน้อง

เพื่อให้เราจัดเตรียมน้องและสัมภาระให้พร้อมนะคะ 🧳
หากมีการเปลี่ยนแปลงเพิ่มเติม สามารถแจ้งได้เลยค่ะ

💬 หากประทับใจการบริการของทีม Pawsome Space
สามารถรีวิวให้เราใน Google Map เพื่อเป็นกำลังใจให้พี่เลี้ยงได้เลยนะคะ 🩷
👉🏻 https://maps.app.goo.gl/8FFgjXfNoNimCpQP7👈🏻

รีวิวแล้ว อย่าลืมแคปหน้าจอส่งมาใน LINE นี้ เพื่อเลือกรับของขวัญ หรือส่วนลด 100 บาท สำหรับการเข้าพักครั้งถัดไป ✨

ขอบคุณมากๆ ที่ให้เราดูแลน้องในช่วงที่ผ่านมานะคะ 💛`;
}

export type ReminderResult = {
  kind: "CHECKIN" | "CHECKOUT";
  orderCode: string;
  outcome: "sent" | "would-send" | "already-sent" | "skipped" | "failed";
  note?: string;
};

/**
 * ส่ง LINE แจ้งเตือนออเดอร์โรงแรมที่ "พรุ่งนี้" เช็คอิน / เช็คเอาท์ (นับวันตามเวลาไทย) — เรียกวันละครั้งจาก cron
 *
 * ส่งเฉพาะออเดอร์ที่ร้านรับแล้ว (ไม่นับรอเช็คคิว / ยกเลิก / เสร็จสิ้น) และลูกค้าผูก LINE ไว้
 * - เช็คอิน: ไม่ส่งถ้าทำรายการวันเดียวกับวันเข้าพัก (จองแล้วเข้าพักเลย ไม่ต้องคอนเฟิร์มล่วงหน้า)
 * - เช็คเอาท์: ไม่ส่งถ้าเข้าและออกวันเดียวกัน (Daycare / Pawsome) เพราะวันก่อนเช็คเอาท์คือวันก่อนเข้าพัก
 *   ลูกค้าจะได้ข้อความเช็คอินกับข้อความขอรีวิวพร้อมกันทั้งที่ยังไม่ได้มาใช้บริการ
 *
 * dryRun = true: คืนรายการที่จะส่งโดยไม่ส่งจริงและไม่บันทึกอะไร (ไว้ตรวจก่อนเปิดใช้)
 */
export async function runStayReminders({
  now = new Date(),
  dryRun = false,
}: { now?: Date; dryRun?: boolean } = {}): Promise<ReminderResult[]> {
  const today = toThaiDateStr(now);
  const tomorrow = addDaysThai(today, 1);
  const { start, end } = thaiDayRange(tomorrow);
  const activeStatuses = ["PENDING_PAYMENT", "DEPOSIT_PAID", "PAID", "IN_PROGRESS"] as const;

  const select = {
    id: true,
    code: true,
    createdAt: true,
    checkInAt: true,
    checkOutAt: true,
    customer: { select: { lineUserId: true } },
    activityLogs: {
      where: { action: { in: [CHECKIN_REMINDER_LOG, CHECKOUT_REMINDER_LOG] as string[] } },
      select: { action: true },
    },
  } as const;

  const [checkIns, checkOuts] = await Promise.all([
    prisma.order.findMany({
      where: { roomId: { not: null }, status: { in: [...activeStatuses] }, checkInAt: { gte: start, lt: end } },
      select,
    }),
    prisma.order.findMany({
      where: { roomId: { not: null }, status: { in: [...activeStatuses] }, checkOutAt: { gte: start, lt: end } },
      select,
    }),
  ]);

  const results: ReminderResult[] = [];

  async function handle(
    kind: ReminderResult["kind"],
    order: (typeof checkIns)[number],
    logAction: string,
    text: string,
    skipReason: string | null
  ) {
    const base = { kind, orderCode: order.code };
    if (order.activityLogs.some((l) => l.action === logAction)) {
      results.push({ ...base, outcome: "already-sent" });
      return;
    }
    if (skipReason) {
      results.push({ ...base, outcome: "skipped", note: skipReason });
      return;
    }
    const lineUserId = order.customer?.lineUserId;
    if (!lineUserId) {
      results.push({ ...base, outcome: "skipped", note: "ลูกค้าไม่ได้ผูก LINE" });
      return;
    }
    if (dryRun) {
      results.push({ ...base, outcome: "would-send" });
      return;
    }
    try {
      await sendLinePush(lineUserId, text);
      await prisma.orderActivityLog.create({ data: { orderId: order.id, action: logAction } });
      results.push({ ...base, outcome: "sent" });
    } catch (e) {
      results.push({ ...base, outcome: "failed", note: e instanceof Error ? e.message : String(e) });
    }
  }

  for (const o of checkIns) {
    const checkInDate = toThaiDateStr(o.checkInAt!);
    await handle(
      "CHECKIN",
      o,
      CHECKIN_REMINDER_LOG,
      checkInReminderText(formatDateLong(o.checkInAt!)),
      toThaiDateStr(o.createdAt) === checkInDate ? "ทำรายการวันเดียวกับวันเข้าพัก" : null
    );
  }
  for (const o of checkOuts) {
    await handle(
      "CHECKOUT",
      o,
      CHECKOUT_REMINDER_LOG,
      checkOutReminderText(formatDateLong(o.checkOutAt!)),
      o.checkInAt && toThaiDateStr(o.checkInAt) === toThaiDateStr(o.checkOutAt!)
        ? "เข้าและออกวันเดียวกัน"
        : null
    );
  }

  return results;
}
