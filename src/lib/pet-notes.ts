/**
 * ช่อง "โรคประจำตัว/แพ้" เป็นข้อความพิมพ์อิสระ พนักงานบางคนเว้นว่าง บางคนพิมพ์ว่า "ไม่มี" / "-"
 * ทั้งสองแบบแปลว่าไม่มีโรคเหมือนกัน จึงต้องไม่เอาไปโชว์เป็นคำเตือนสีแดงข้างชื่อสัตว์
 *
 * รวมกฎไว้ที่เดียวเพื่อให้ทุกหน้า (รายละเอียดออเดอร์ / ใบเสร็จ / หน้าลูกค้าบน LINE) ตัดสินเหมือนกัน
 */
const NONE_WORDS = [
  "ไม่มี",
  "ไม่มีโรค",
  "ไม่มีโรคประจำตัว",
  "ไม่ระบุ",
  "-",
  "--",
  "none",
  "no",
  "n/a",
  "na",
];

/** คืนข้อความโรคประจำตัวที่ควรแสดงจริง หรือ null ถ้าว่าง/แปลว่าไม่มี */
export function allergyText(value: string | null | undefined): string | null {
  const trimmed = value?.trim();
  if (!trimmed) return null;
  const normalized = trimmed.toLowerCase().replace(/[\s.]/g, "");
  if (NONE_WORDS.some((w) => normalized === w.toLowerCase().replace(/[\s.]/g, ""))) return null;
  return trimmed;
}
