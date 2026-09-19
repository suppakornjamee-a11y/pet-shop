/**
 * ระบบตรวจข้อมูลยาเห็บหมัด — ตรรกะล้วน ใช้ได้ทั้งฝั่งเซิร์ฟเวอร์และเบราว์เซอร์
 *
 * หลักสำคัญ:
 * - ระยะคุ้มครองมาจากฐานข้อมูลยาที่ผู้จัดการ "ยืนยันแล้ว" เท่านั้น ไม่เดา ไม่ประมาณ
 * - เห็บกับหมัดคิดแยกกัน ถ้าฉลากไม่ได้ระบุอย่างใดอย่างหนึ่ง = ข้อมูลไม่ครบ (ไม่ถือว่าคุ้มครอง)
 * - สัปดาห์นับเป็นวันพอดี (12 สัปดาห์ = 84 วัน) เดือนนับตามปฏิทิน
 * - วันที่ให้ยาในอนาคตไม่ใช่ประวัติการให้ยา
 * - ผ่านเกณฑ์ = ข้อมูลที่บันทึกไว้ครอบคลุมถึงวันบริการ ไม่ใช่การรับรองว่าปลอดเห็บหมัด
 */
import { addDaysThai, toThaiDateStr } from "@/lib/slots";

export type DurationUnit = "DAY" | "WEEK" | "MONTH";
export type Species = "DOG" | "CAT";

export type FleaTickProductInfo = {
  id: string;
  name: string;
  formula: string | null;
  aliases: string[];
  species: Species | null;
  form: "CHEWABLE" | "SPOT_ON" | "COLLAR" | "OTHER";
  tickValue: number | null;
  tickUnit: DurationUnit | null;
  fleaValue: number | null;
  fleaUnit: DurationUnit | null;
  bathNote: string | null;
  status: "PENDING" | "VERIFIED";
};

/** บวกระยะเวลาให้วันที่ (YYYY-MM-DD) — สัปดาห์ = 7 วันพอดี, เดือน = เดือนปฏิทิน (31 ม.ค. + 1 เดือน = 28/29 ก.พ.) */
export function addDuration(dateStr: string, value: number, unit: DurationUnit): string {
  if (unit === "DAY") return addDaysThai(dateStr, value);
  if (unit === "WEEK") return addDaysThai(dateStr, value * 7);
  const [y, m, d] = dateStr.split("-").map(Number);
  const target = new Date(Date.UTC(y, m - 1 + value, 1));
  const lastDay = new Date(Date.UTC(target.getUTCFullYear(), target.getUTCMonth() + 1, 0)).getUTCDate();
  target.setUTCDate(Math.min(d, lastDay));
  return target.toISOString().slice(0, 10);
}

export type FleaTickStatusKind = "COVERED" | "DUE_BEFORE_SERVICE" | "INCOMPLETE";

export type FleaTickStatus = {
  kind: FleaTickStatusKind;
  /** วันครบกำหนดให้ยาครั้งถัดไป (วันที่ระยะคุ้มครองอันสั้นกว่าสิ้นสุด) — มีเฉพาะเมื่อคำนวณได้ */
  nextDueDate: string | null;
  tickUntil: string | null;
  fleaUntil: string | null;
  /** เหตุผลที่ข้อมูลไม่ครบ — ใช้แสดงให้พนักงานรู้ว่าต้องตรวจอะไร */
  reasons: FleaTickIncompleteReason[];
};

export type FleaTickIncompleteReason =
  | "NO_DATE"
  | "FUTURE_DATE"
  | "NO_PRODUCT"
  | "PRODUCT_NOT_VERIFIED"
  | "SPECIES_MISMATCH"
  | "NO_TICK_PERIOD"
  | "NO_FLEA_PERIOD";

/**
 * คำนวณสถานะเทียบกับวันบริการ (YYYY-MM-DD)
 * - DUE_BEFORE_SERVICE: ระยะคุ้มครองตามข้อมูลสิ้นสุดก่อนหรือตรงวันบริการ
 * - COVERED: อยู่ในช่วงตามข้อมูลที่แจ้งจนถึงวันบริการ
 * - INCOMPLETE: ข้อมูลไม่ครบหรือรอตรวจสอบ (ไม่คำนวณ ไม่เดา)
 */
export function computeFleaTickStatus(input: {
  givenAt: Date | string | null;
  product: FleaTickProductInfo | null;
  petSpecies: Species;
  serviceDate: string;
  today?: string;
}): FleaTickStatus {
  const today = input.today ?? toThaiDateStr(new Date());
  const reasons: FleaTickIncompleteReason[] = [];
  const given =
    input.givenAt == null
      ? null
      : typeof input.givenAt === "string"
        ? input.givenAt.slice(0, 10)
        : toThaiDateStr(input.givenAt);

  if (!given) reasons.push("NO_DATE");
  else if (given > today) reasons.push("FUTURE_DATE");

  const p = input.product;
  if (!p) reasons.push("NO_PRODUCT");
  else {
    if (p.status !== "VERIFIED") reasons.push("PRODUCT_NOT_VERIFIED");
    if (p.species && p.species !== input.petSpecies) reasons.push("SPECIES_MISMATCH");
    if (!p.tickValue || !p.tickUnit) reasons.push("NO_TICK_PERIOD");
    if (!p.fleaValue || !p.fleaUnit) reasons.push("NO_FLEA_PERIOD");
  }

  if (reasons.length > 0 || !given || !p) {
    return { kind: "INCOMPLETE", nextDueDate: null, tickUntil: null, fleaUntil: null, reasons };
  }

  const tickUntil = addDuration(given, p.tickValue!, p.tickUnit!);
  const fleaUntil = addDuration(given, p.fleaValue!, p.fleaUnit!);
  const nextDueDate = tickUntil < fleaUntil ? tickUntil : fleaUntil;
  return {
    kind: nextDueDate <= input.serviceDate ? "DUE_BEFORE_SERVICE" : "COVERED",
    nextDueDate,
    tickUntil,
    fleaUntil,
    reasons: [],
  };
}

/* ---------- จับคู่ชื่อยาที่ลูกค้าพิมพ์ (ไม่ใช้ AI) ---------- */

/** ตัดช่องว่าง เครื่องหมาย และตัวพิมพ์ใหญ่ออก ให้ "Nex Gard", "nexgard." เทียบกันได้ */
export function normalizeMedicineName(s: string): string {
  return s.toLowerCase().normalize("NFC").replace(/[\s\-_.,/()+]/g, "");
}

function editDistance(a: string, b: string): number {
  const row = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    let prev = row[0];
    row[0] = i;
    for (let j = 1; j <= b.length; j++) {
      const tmp = row[j];
      row[j] = Math.min(row[j] + 1, row[j - 1] + 1, prev + (a[i - 1] === b[j - 1] ? 0 : 1));
      prev = tmp;
    }
  }
  return row[b.length];
}

/** ความใกล้เคียง 0–1 ระหว่างคำที่พิมพ์กับชื่อหนึ่งชื่อ */
function similarity(query: string, name: string): number {
  if (!query || !name) return 0;
  if (query === name) return 1;
  if (name.includes(query) && query.length >= 3) return 0.9;
  if (query.includes(name) && name.length >= 3) return 0.85;
  return 1 - editDistance(query, name) / Math.max(query.length, name.length);
}

export type MedicineMatch = { product: FleaTickProductInfo; score: number; exact: boolean };

/**
 * หายาที่ชื่อใกล้เคียงกับที่พิมพ์ เรียงจากใกล้ที่สุด — กรองตามชนิดสัตว์ (ยาที่ไม่ระบุชนิดแสดงเสมอ)
 * คืนหลายรายการได้ เช่นพิมพ์ "NexGard" จะได้ทั้ง NexGard / Spectra / Combo ให้ลูกค้าเลือกสูตรเอง
 */
export function matchMedicine(
  query: string,
  products: FleaTickProductInfo[],
  petSpecies: Species | null
): MedicineMatch[] {
  const q = normalizeMedicineName(query);
  if (q.length < 2) return [];
  const out: MedicineMatch[] = [];
  for (const p of products) {
    if (petSpecies && p.species && p.species !== petSpecies) continue;
    const names = [p.name, p.formula ?? "", ...p.aliases].map(normalizeMedicineName).filter(Boolean);
    let best = 0;
    let exact = false;
    for (const n of names) {
      const s = similarity(q, n);
      if (s > best) best = s;
      if (q === n) exact = true;
    }
    if (best >= 0.6) out.push({ product: p, score: best, exact });
  }
  return out.sort((a, b) => b.score - a.score || a.product.name.localeCompare(b.product.name, "th"));
}
