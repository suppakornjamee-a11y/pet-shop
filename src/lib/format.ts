export function formatBaht(amount: number): string {
  return new Intl.NumberFormat("th-TH", {
    style: "currency",
    currency: "THB",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
}

export function formatNumber(n: number): string {
  return new Intl.NumberFormat("th-TH").format(n);
}

/**
 * ร้านอยู่ไทย ทุกวันเวลาที่แสดงต้องเป็นเวลาไทยเสมอ ไม่ว่าเซิร์ฟเวอร์จะอยู่โซนไหน
 * ไม่ระบุไว้ Intl จะใช้โซนของเครื่องที่รัน — เครื่องเราเป็นเวลาไทยเลยดูถูก แต่ Vercel รันเป็น UTC
 * หน้าที่เรนเดอร์ฝั่งเซิร์ฟเวอร์จึงโชว์เวลาช้าไป 7 ชั่วโมง (และวันที่เลื่อนถอยหนึ่งวันช่วงก่อน 07:00)
 */
const TIME_ZONE = "Asia/Bangkok";

export function formatDate(date: Date | string): string {
  const d = typeof date === "string" ? new Date(date) : date;
  return new Intl.DateTimeFormat("th-TH", {
    dateStyle: "medium",
    timeZone: TIME_ZONE,
  }).format(d);
}

export function formatDateLong(date: Date | string): string {
  const d = typeof date === "string" ? new Date(date) : date;
  return new Intl.DateTimeFormat("th-TH", {
    dateStyle: "long",
    timeZone: TIME_ZONE,
  }).format(d);
}

export function formatDateTime(date: Date | string): string {
  const d = typeof date === "string" ? new Date(date) : date;
  return new Intl.DateTimeFormat("th-TH", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: TIME_ZONE,
  }).format(d);
}

/** วัน/เดือน/ปี ตามปฏิทินไทย — ใช้แทน getFullYear()/getMonth()/getDate() ที่อ่านตามโซนของเครื่อง */
function thaiDateParts(d: Date): { y: number; m: number; day: number } {
  const [y, m, day] = new Intl.DateTimeFormat("en-CA", {
    timeZone: TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  })
    .format(d)
    .split("-")
    .map(Number);
  return { y, m, day };
}

export function ageFromBirthDate(birthDate: Date): { years: number; months: number } {
  const now = thaiDateParts(new Date());
  const born = thaiDateParts(birthDate);
  let years = now.y - born.y;
  let months = now.m - born.m;
  if (now.day < born.day) months -= 1;
  if (months < 0) {
    years -= 1;
    months += 12;
  }
  if (years < 0) return { years: 0, months: 0 };
  return { years, months };
}

export function formatTime(date: Date | string): string {
  const d = typeof date === "string" ? new Date(date) : date;
  return new Intl.DateTimeFormat("th-TH", {
    timeStyle: "short",
    timeZone: TIME_ZONE,
  }).format(d);
}
