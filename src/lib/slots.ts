// ช่วงเวลาคิวของร้าน (ปรับได้) — ทุกอย่างอิงเวลาไทย (Asia/Bangkok)
export const TIME_SLOTS = [
  "09:00",
  "10:00",
  "11:00",
  "12:00",
  "13:00",
  "14:00",
  "15:00",
  "16:00",
  "17:00",
  "18:00",
] as const;

const TZ = "Asia/Bangkok";

/** สร้าง Date ของ slot จากวันที่ (YYYY-MM-DD) + เวลา (HH:mm) ตามเวลาไทย */
export function buildSlotDate(dateStr: string, timeStr: string): Date {
  return new Date(`${dateStr}T${timeStr}:00+07:00`);
}

/** วันที่ (YYYY-MM-DD) ตามเวลาไทย */
export function toThaiDateStr(d: Date): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(d);
}

/** เวลา (HH:mm) ตามเวลาไทย */
export function toThaiTimeStr(d: Date): string {
  return new Intl.DateTimeFormat("en-GB", {
    timeZone: TZ,
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(d);
}

/** วันนี้ (YYYY-MM-DD) เวลาไทย */
export function todayThaiStr(): string {
  return toThaiDateStr(new Date());
}

/** ช่วง UTC ของ "วันไทย" นั้น สำหรับ query */
export function thaiDayRange(dateStr: string): { start: Date; end: Date } {
  const start = new Date(`${dateStr}T00:00:00+07:00`);
  const end = new Date(start.getTime() + 24 * 60 * 60 * 1000);
  return { start, end };
}

/** ช่วง UTC ของ "เดือนไทย" (YYYY-MM) สำหรับ query */
export function thaiMonthRange(monthStr: string): { start: Date; end: Date } {
  const [y, m] = monthStr.split("-").map(Number);
  const start = new Date(`${monthStr}-01T00:00:00+07:00`);
  const nextY = m === 12 ? y + 1 : y;
  const nextM = m === 12 ? 1 : m + 1;
  const end = new Date(
    `${nextY}-${String(nextM).padStart(2, "0")}-01T00:00:00+07:00`
  );
  return { start, end };
}

export function isValidDateStr(s: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(s);
}
/** รับเวลา HH:mm ทั่วไป (00:00–23:59) — ไม่จำกัดแค่ช่วงเวลาสำเร็จรูป */
export function isValidTimeStr(s: string): boolean {
  return /^([01]\d|2[0-3]):[0-5]\d$/.test(s);
}
/** เป็นช่วงเวลาสำเร็จรูปหรือไม่ */
export function isPresetSlot(s: string): boolean {
  return (TIME_SLOTS as readonly string[]).includes(s);
}
/** slot นี้เป็นเวลาที่ผ่านมาแล้ว (จองย้อนหลังไม่ได้) */
export function isPastSlot(dateStr: string, timeStr: string): boolean {
  return buildSlotDate(dateStr, timeStr).getTime() < Date.now();
}
