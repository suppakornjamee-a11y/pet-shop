/**
 * ตรวจความถูกต้องของข้อมูลยาเห็บหมัดตอนจองอาบน้ำ — ตรรกะล้วน ใช้ร่วมกันทั้งหน้าจองบน LINE และฝั่งเซิร์ฟเวอร์
 * (เซิร์ฟเวอร์ตัดสินซ้ำเสมอ ไม่เชื่อผลจากหน้าจอ)
 *
 * แบ่งผลเป็นสามระดับ:
 *  เขียว  ผ่านเอง — ยาอยู่ในฐานข้อมูลของร้าน ตรงชนิดสัตว์ วันที่สมเหตุสมผล และ "วันที่ให้ยา + ระยะคุ้มครองของยา" ยังครอบคลุมวันบริการ
 *         (เช่น NexGard คุ้มครอง 1 เดือน ให้ยา 15 ก.ย. → ครอบคลุมถึงก่อน 15 ต.ค.)
 *  เหลือง ลูกค้าแจ้งข้อมูลยาใหม่ (ฟอร์ม "มีข้อมูลอัปเดต") พร้อมหลักฐาน และข้อมูลใหม่ผ่านเกณฑ์ — พนักงานดูหลักฐานได้ ไม่ต้องตัดสินใจ
 *  แดง    รอแอดมินตรวจตอนเช็คคิว — ยาหมดช่วงคุ้มครองก่อนวันบริการ ไม่มีข้อมูล/ไม่ครบ ยาไม่อยู่ในระบบ ยาไม่ตรงชนิดสัตว์ วันที่ผิดปกติ
 *
 * ไม่ถามอะไรลูกค้าในหน้าเลือกวันเวลา: ผ่านก็แสดงตราเขียว ไม่ผ่านก็แสดงตรารอตรวจสอบ แล้วให้แอดมินตัดสินใจ
 *
 * ระบบพิสูจน์ไม่ได้ว่าให้ยาจริง — ตรวจได้แค่ความขัดกันของข้อมูลและเก็บหลักฐาน การตรวจเห็บหมัดจริงยังเป็นหน้าที่พนักงาน
 */
import { isValidDateStr } from "@/lib/slots";
import {
  REQUIRE_VERIFIED_PRODUCTS,
  computeFleaTickStatus,
  normalizeMedicineName,
  type FleaTickProductInfo,
  type FleaTickStatus,
  type Species,
} from "@/lib/flea-tick";

export type FleaLevel = "GREEN" | "YELLOW" | "RED";
export type FleaRed =
  | "NO_DATA"
  | "INCOMPLETE"
  | "DATE_BEFORE_BIRTH"
  | "EXPIRED"
  | "NOT_COVERED"
  | "NOT_IN_DB"
  | "SPECIES_MISMATCH";

export type FleaPetData = {
  species: Species;
  /** YYYY-MM-DD หรือ null ถ้าไม่ทราบ */
  birthDate: string | null;
  medicine: string;
  productId: string | null;
  /** วันที่ให้ยาล่าสุด YYYY-MM-DD หรือ null */
  givenAt: string | null;
};

export type FleaAssessment =
  | { level: "GREEN"; status: FleaTickStatus }
  | { level: "RED"; reasons: FleaRed[]; status: FleaTickStatus };

function findProduct(data: FleaPetData, catalog: FleaTickProductInfo[]) {
  return data.productId ? (catalog.find((p) => p.id === data.productId) ?? null) : null;
}

/** ประเมินข้อมูลยาเทียบกับวันบริการ: ผ่าน (เขียว) หรือรอแอดมินตรวจ (แดง) */
export function assessFleaTick(
  data: FleaPetData,
  catalog: FleaTickProductInfo[],
  serviceDate: string,
  today: string
): FleaAssessment {
  const product = findProduct(data, catalog);
  const status = computeFleaTickStatus({
    givenAt: data.givenAt,
    product,
    petSpecies: data.species,
    serviceDate,
    today,
  });
  const hasMedicine = !!data.medicine.trim() || !!product;
  const hasDate = !!data.givenAt;

  if (!hasMedicine && !hasDate) return { level: "RED", reasons: ["NO_DATA"], status };
  if (hasMedicine !== hasDate) return { level: "RED", reasons: ["INCOMPLETE"], status };
  if (data.birthDate && data.givenAt! < data.birthDate) return { level: "RED", reasons: ["DATE_BEFORE_BIRTH"], status };
  if (status.reasons.includes("FUTURE_DATE")) return { level: "RED", reasons: ["INCOMPLETE"], status };
  if (status.reasons.includes("SPECIES_MISMATCH")) return { level: "RED", reasons: ["SPECIES_MISMATCH"], status };
  const unusable = status.reasons.some(
    (r) => r === "PRODUCT_NOT_VERIFIED" || r === "NO_TICK_PERIOD" || r === "NO_FLEA_PERIOD" || r === "NO_PRODUCT"
  );
  if (!product || unusable) return { level: "RED", reasons: ["NOT_IN_DB"], status };
  if (status.kind === "DUE_BEFORE_SERVICE") return { level: "RED", reasons: ["EXPIRED"], status };
  return { level: "GREEN", status };
}

/* ---------- คำตอบของลูกค้า ---------- */

/** declare = แจ้งข้อมูลยาใหม่/แก้ไข · none = ค่าเก่าจากตะกร้าที่เก็บไว้ในเครื่อง (ไม่ใช้แล้ว รับไว้เฉยๆ ไม่ให้ตะกร้าเก่าพัง) */
export type FleaAnswer = "declare" | "none";

export type FleaDeclaration = {
  medicine: string;
  productId: string | null;
  /** วันที่ให้ยา YYYY-MM-DD */
  date: string;
  evidence: string[];
};

export type FleaDeclarationError =
  | "MEDICINE"
  | "DATE"
  | "DATE_FUTURE"
  | "DATE_BEFORE_BIRTH"
  | "DATE_UNCHANGED"
  | "DATE_NOT_NEWER"
  | "EVIDENCE";

/** ยาที่แจ้งใหม่ต่างจากที่บันทึกไว้ไหม — เทียบรหัสยาถ้ามีทั้งคู่ ไม่งั้นเทียบชื่อที่พิมพ์ (ไม่มียาเดิมเลย = ไม่ใช่การเปลี่ยนยา) */
export function medicineChanged(
  stored: Pick<FleaPetData, "medicine" | "productId">,
  next: Pick<FleaDeclaration, "medicine" | "productId">
): boolean {
  const hadAny = !!stored.medicine.trim() || !!stored.productId;
  if (!hadAny) return false;
  if (stored.productId && next.productId) return stored.productId !== next.productId;
  return normalizeMedicineName(stored.medicine) !== normalizeMedicineName(next.medicine);
}

/** ข้อมูลยาที่กรอกมาต่างจากที่บันทึกไว้ไหม (ชื่อยา / รหัสยา / วันที่ / มีรูปแนบ) — ไม่ต่าง = ลูกค้าไม่ได้แก้อะไร ไม่ต้องตรวจซ้ำ */
export function fleaInfoChanged(stored: FleaPetData, next: FleaDeclaration): boolean {
  const hadAny = !!stored.medicine.trim() || !!stored.productId;
  const medicineDiffers = hadAny
    ? medicineChanged(stored, next) || (next.productId ?? null) !== (stored.productId ?? null)
    : !!next.medicine.trim() || !!next.productId;
  return medicineDiffers || (next.date || "") !== (stored.givenAt ?? "") || next.evidence.length > 0;
}

/**
 * ต้องแนบรูปหลักฐาน (กล่องยา / ใบเสร็จ / สมุดสัตวแพทย์) เมื่อ: ยาเดิมหมดช่วงคุ้มครองหรือไม่ตรงชนิดสัตว์แล้วแจ้งข้อมูลใหม่,
 * เปลี่ยนยา หรือยาที่แจ้งไม่อยู่ในฐานข้อมูลของร้าน
 */
export function evidenceRequired(
  pre: FleaAssessment,
  stored: FleaPetData,
  next: Pick<FleaDeclaration, "medicine" | "productId">,
  catalog: FleaTickProductInfo[]
): boolean {
  if (pre.level === "RED" && pre.reasons.some((r) => r === "EXPIRED" || r === "SPECIES_MISMATCH")) return true;
  if (medicineChanged(stored, next)) return true;
  const product = next.productId ? catalog.find((p) => p.id === next.productId) : null;
  return !product || (REQUIRE_VERIFIED_PRODUCTS && product.status !== "VERIFIED");
}

/** ตรวจคำตอบแบบ "แจ้งข้อมูลใหม่" — คืนข้อผิดพลาดแรกที่เจอ หรือ null ถ้าใช้ได้ */
export function validateFleaDeclaration(input: {
  declaration: FleaDeclaration;
  pre: FleaAssessment;
  stored: FleaPetData;
  catalog: FleaTickProductInfo[];
  today: string;
}): FleaDeclarationError | null {
  const { declaration: d, pre, stored, catalog, today } = input;
  if (!d.medicine.trim() && !d.productId) return "MEDICINE";
  if (!isValidDateStr(d.date)) return "DATE";
  if (d.date > today) return "DATE_FUTURE";
  if (stored.birthDate && d.date < stored.birthDate) return "DATE_BEFORE_BIRTH";
  // เปลี่ยนยาแล้วแต่ยังเป็นวันที่เดิม = วันที่ของยาตัวเก่า ถ้าปล่อยผ่านจะเอาไปนับระยะคุ้มครองของยาตัวใหม่ผิด
  if (medicineChanged(stored, d) && stored.givenAt && d.date === stored.givenAt) return "DATE_UNCHANGED";
  // ครบกำหนดแล้วบอกว่าให้ยาครั้งใหม่ วันที่ต้องใหม่กว่าที่บันทึกไว้เดิม ไม่งั้นก็คือข้อมูลเก่าชุดเดิม
  if (pre.level === "RED" && pre.reasons.includes("EXPIRED") && stored.givenAt && d.date <= stored.givenAt) return "DATE_NOT_NEWER";
  if (evidenceRequired(pre, stored, d, catalog) && d.evidence.length === 0) return "EVIDENCE";
  return null;
}

/* ---------- ผลสรุปหลังลูกค้าตอบ ---------- */

export type FleaResult = { level: FleaLevel; reasons: FleaRed[] };

/**
 * สรุประดับสุดท้ายที่พนักงานจะเห็น
 * - ไม่ได้แจ้งข้อมูลใหม่ → ตามการประเมินเดิม (เขียว / แดง)
 * - แจ้งข้อมูลใหม่ → ประเมินข้อมูลใหม่ (post): ผ่านเกณฑ์ = เหลือง (มีหลักฐานแนบ) ไม่ผ่าน = แดงพร้อมเหตุผล
 */
export function resolveFleaResult(
  pre: FleaAssessment,
  answer: FleaAnswer | null,
  post: FleaAssessment | null
): FleaResult {
  if (answer === "declare" && post) {
    if (post.level === "GREEN") return { level: "YELLOW", reasons: [] };
    // ยาที่แจ้งใหม่ยังไม่ครอบคลุมวันบริการ = "ยาที่ลูกค้าแจ้งใหม่ยังครบกำหนดก่อนวันบริการ"
    return { level: "RED", reasons: post.reasons.map((r) => (r === "EXPIRED" ? "NOT_COVERED" : r)) };
  }
  if (pre.level === "GREEN") return { level: "GREEN", reasons: [] };
  return { level: "RED", reasons: pre.reasons };
}

/** ข้อความอธิบายเหตุผลระดับแดง — ใช้เขียนลงประวัติออเดอร์ให้พนักงานอ่าน */
export const FLEA_RED_TEXT: Record<FleaRed, string> = {
  NO_DATA: "ยังไม่มีข้อมูลยาเห็บหมัด",
  INCOMPLETE: "ข้อมูลยาเห็บหมัดไม่ครบ (ขาดชื่อยาหรือวันที่ให้ยา)",
  DATE_BEFORE_BIRTH: "วันที่ให้ยาเห็บหมัดอยู่ก่อนวันเกิดของสัตว์เลี้ยง",
  EXPIRED: "ยาที่แจ้งไว้หมดช่วงคุ้มครองก่อนวันบริการ รอพนักงานตรวจสอบ",
  NOT_COVERED: "ยาที่ลูกค้าแจ้งใหม่ยังครบกำหนดก่อนวันบริการ",
  NOT_IN_DB: "ชื่อยาไม่อยู่ในฐานข้อมูลของร้าน รอพนักงานตรวจสอบ",
  SPECIES_MISMATCH: "ยาที่แจ้งไม่ตรงกับชนิดสัตว์เลี้ยง รอพนักงานตรวจสอบ",
};

export const FLEA_GREEN_TEXT = "อยู่ในช่วงคุ้มครองถึงวันบริการตามข้อมูลที่แจ้ง";
export const FLEA_YELLOW_TEXT = "ลูกค้าแจ้งข้อมูลยาใหม่พร้อมหลักฐาน";

/** ข้อความในประวัติออเดอร์ตามระดับ (เหตุผลระดับแดงต่อกันด้วย " / ") */
export function fleaResultText(result: FleaResult): string {
  if (result.level === "GREEN") return FLEA_GREEN_TEXT;
  if (result.level === "YELLOW") return FLEA_YELLOW_TEXT;
  return result.reasons.map((r) => FLEA_RED_TEXT[r]).join(" / ");
}
