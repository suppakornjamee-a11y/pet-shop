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

const WORD_SEPARATORS = /[\s\-_.,/()+]+/;

/**
 * ความใกล้เคียง 0–1 ระหว่างคำที่พิมพ์ (q ผ่าน normalizeMedicineName แล้ว) กับชื่อหนึ่งชื่อ (ชื่อหลัก / สูตร / ชื่อใกล้เคียง)
 * เรียงความสำคัญ: ตรงทั้งคำ 1 > พิมพ์ขึ้นต้นชื่อ 0.95 > ขึ้นต้นคำใดคำหนึ่งในชื่อ 0.92 > อยู่กลางชื่อ 0.85 >
 * พิมพ์ผิดเล็กน้อย (เทียบทั้งชื่อ หรือเทียบเฉพาะส่วนหน้าเท่าที่พิมพ์ไว้แล้ว)
 * คำที่พิมพ์สั้นมาก (1-3 ตัว) ไม่ใช้การเดาแบบพิมพ์ผิด กันได้ยาที่ไม่เกี่ยวข้องขึ้นมา
 */
function scoreName(q: string, rawName: string): number {
  const n = normalizeMedicineName(rawName);
  if (!q || !n) return 0;
  if (q === n) return 1;
  let best = 0;
  if (n.startsWith(q)) best = 0.95;
  else if (
    rawName
      .split(WORD_SEPARATORS)
      .map(normalizeMedicineName)
      .some((w) => w.startsWith(q))
  ) {
    best = 0.92;
  }
  if (q.length >= 3 && n.includes(q)) best = Math.max(best, 0.85);
  // พิมพ์ยาวกว่าชื่อ (เช่น ใส่ขนาดน้ำหนักต่อท้าย) — ชื่อที่ครอบคลุมคำที่พิมพ์มากกว่าได้คะแนนสูงกว่า
  if (n.length >= 3 && q.includes(n)) best = Math.max(best, 0.8 + 0.1 * (n.length / q.length));
  if (q.length >= 4) {
    best = Math.max(best, 0.9 * (1 - editDistance(q, n.slice(0, q.length)) / q.length));
    best = Math.max(best, 1 - editDistance(q, n) / Math.max(q.length, n.length));
  }
  return best;
}

const MATCH_THRESHOLD = 0.6;

type NameSet = { name: string; formula: string | null; aliases: string[] };

/** ความใกล้เคียงสูงสุดของคำที่พิมพ์กับทุกชื่อของยาตัวหนึ่ง + ชื่อที่ตรงที่สุด */
function bestNameMatch(q: string, p: NameSet): { score: number; via: string; exact: boolean } {
  let score = 0;
  let via = "";
  let exact = false;
  for (const raw of [p.name, p.formula ?? "", ...p.aliases]) {
    const s = scoreName(q, raw);
    if (s > score) {
      score = s;
      via = raw;
    }
    if (s === 1) exact = true;
  }
  return { score, via, exact };
}

export type MedicineMatch = { product: FleaTickProductInfo; score: number; exact: boolean; via: string };

/**
 * หายาที่ชื่อใกล้เคียงกับที่พิมพ์ เรียงจากใกล้ที่สุด — กรองตามชนิดสัตว์ (ยาที่ไม่ระบุชนิดแสดงเสมอ)
 * พิมพ์แค่ส่วนแรกของชื่อ (เช่น "Sim" → Simparica) หรือชื่อไทย/ชื่อใกล้เคียงที่ร้านตั้งไว้ก็เจอ
 * คืนหลายรายการได้ เช่นพิมพ์ "NexGard" จะได้ทั้ง NexGard / Spectra / Combo ให้ลูกค้าเลือกสูตรเอง
 */
export function matchMedicine(
  query: string,
  products: FleaTickProductInfo[],
  petSpecies: Species | null
): MedicineMatch[] {
  const q = normalizeMedicineName(query);
  if (q.length < 1) return [];
  const out: MedicineMatch[] = [];
  for (const p of products) {
    if (petSpecies && p.species && p.species !== petSpecies) continue;
    const { score, via, exact } = bestNameMatch(q, p);
    if (score >= MATCH_THRESHOLD) out.push({ product: p, score, exact, via });
  }
  return out.sort((a, b) => b.score - a.score || a.product.name.localeCompare(b.product.name, "th"));
}

/** ใช้ทดสอบหลังบ้านว่าคำที่ลูกค้าอาจพิมพ์จะทำให้ยานี้ขึ้นให้เลือกไหม (ตามชื่อหลัก/สูตร/ชื่อใกล้เคียงที่กำลังกรอก) */
export function testMedicineMatch(query: string, names: NameSet): { score: number; via: string } | null {
  const q = normalizeMedicineName(query);
  if (q.length < 1) return null;
  const { score, via } = bestNameMatch(q, names);
  return score >= MATCH_THRESHOLD ? { score, via } : null;
}

/** ชื่อนี้ (ผ่าน normalizeMedicineName แล้วเท่ากัน) ซ้ำกับชื่อหลัก/สูตร/ชื่อใกล้เคียงที่มีอยู่แล้วหรือยัง */
export function medicineNameKnown(name: string, names: NameSet): boolean {
  const n = normalizeMedicineName(name);
  return !!n && [names.name, names.formula ?? "", ...names.aliases].some((x) => normalizeMedicineName(x) === n);
}
