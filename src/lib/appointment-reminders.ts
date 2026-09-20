import { prisma } from "@/lib/prisma";
import { formatDateLong, formatTime } from "@/lib/format";
import { sendLinePush } from "@/lib/line";
import { APPOINTMENT_REMINDER_LOG_PREFIX, appointmentReminderLog } from "@/lib/order-log";
import { addDaysThai, thaiDayRange, toThaiDateStr } from "@/lib/slots";

/** ข้อความเตือนนัด — แก้ถ้อยคำที่นี่ที่เดียว */
export function appointmentReminderText(p: {
  petName: string | null;
  date: string;
  time: string;
  services: string[];
}): string {
  return [
    "🔔 แจ้งเตือนนัดพรุ่งนี้ค่ะ",
    p.petName ? `น้อง${p.petName}` : null,
    `📅 วันที่ ${p.date}`,
    `🕑 เวลา ${p.time} น.`,
    p.services.length > 0 ? `✂️ ${p.services.join(" · ")}` : null,
    "",
    "แล้วพบกันค่ะ 💛",
  ]
    .filter((l): l is string => l !== null)
    .join("\n");
}

export type AppointmentReminderResult = {
  orderCode: string;
  outcome: "sent" | "would-send" | "already-sent" | "skipped" | "failed";
  note?: string;
};

/**
 * ส่ง LINE เตือนนัดอาบน้ำ/บริการอื่นที่ "พรุ่งนี้" (นับวันตามเวลาไทย) — เรียกวันละครั้งจาก cron
 *
 * ส่งเฉพาะรายการที่ยืนยันแล้ว (รับมัดจำ/ชำระครบแล้ว) และลูกค้าผูก LINE ไว้ — คิวที่รอเช็ค รอชำระ หรือยกเลิกไม่ส่ง
 * ค้นจากวันนัด "ปัจจุบัน" ของออเดอร์ทุกครั้ง จึงตามการย้ายนัดเอง: ย้ายไปวันอื่นก็ไปเตือนวันก่อนวันใหม่
 * ส่วนเครื่องหมายส่งแล้วผูกกับวันนัด (ดู appointmentReminderLog) เตือนวันเดิมซ้ำไม่ได้ แต่วันใหม่เตือนได้
 *
 * dryRun = true: คืนรายการที่จะส่งโดยไม่ส่งจริงและไม่บันทึกอะไร
 */
export async function runAppointmentReminders({
  now = new Date(),
  dryRun = false,
}: { now?: Date; dryRun?: boolean } = {}): Promise<AppointmentReminderResult[]> {
  const tomorrow = addDaysThai(toThaiDateStr(now), 1);
  const { start, end } = thaiDayRange(tomorrow);

  const orders = await prisma.order.findMany({
    where: {
      orderType: "SERVICE",
      roomId: null,
      status: { in: ["DEPOSIT_PAID", "PAID"] },
      appointmentAt: { gte: start, lt: end },
    },
    orderBy: { appointmentAt: "asc" },
    select: {
      id: true,
      code: true,
      appointmentAt: true,
      customer: { select: { lineUserId: true } },
      pet: { select: { name: true } },
      items: { where: { itemType: "SERVICE" }, orderBy: { subtotal: "desc" }, select: { name: true, subtotal: true } },
      activityLogs: { where: { action: { startsWith: APPOINTMENT_REMINDER_LOG_PREFIX } }, select: { action: true } },
    },
  });

  const results: AppointmentReminderResult[] = [];
  for (const o of orders) {
    const base = { orderCode: o.code };
    const marker = appointmentReminderLog(tomorrow);
    if (o.activityLogs.some((l) => l.action === marker)) {
      results.push({ ...base, outcome: "already-sent" });
      continue;
    }
    const lineUserId = o.customer?.lineUserId;
    if (!lineUserId) {
      results.push({ ...base, outcome: "skipped", note: "ลูกค้าไม่ได้ผูก LINE" });
      continue;
    }
    if (dryRun) {
      results.push({ ...base, outcome: "would-send" });
      continue;
    }
    // รายการฟรี (ไถเท้า/เช็ดหู ฯลฯ) ไม่ต้องเรียงยาวในข้อความ — ถ้าไม่มีรายการที่มีราคาเลยค่อยแสดงทั้งหมด
    const priced = o.items.filter((it) => it.subtotal > 0);
    const services = (priced.length > 0 ? priced : o.items).map((it) => it.name);
    try {
      await sendLinePush(
        lineUserId,
        appointmentReminderText({
          petName: o.pet?.name ?? null,
          date: formatDateLong(o.appointmentAt!),
          time: formatTime(o.appointmentAt!),
          services,
        })
      );
      await prisma.orderActivityLog.create({ data: { orderId: o.id, action: marker } });
      results.push({ ...base, outcome: "sent" });
    } catch (e) {
      results.push({ ...base, outcome: "failed", note: e instanceof Error ? e.message : String(e) });
    }
  }
  return results;
}
