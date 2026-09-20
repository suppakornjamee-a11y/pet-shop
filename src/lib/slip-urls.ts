/** จำนวนรูปสลิปสูงสุดต่อรายการชำระเงิน — กันฐานข้อมูลบวม (รูปเก็บเป็น data URL ในคอลัมน์เดียว) */
export const MAX_SLIPS = 5;

/** อ่านสลิปทั้งหมดของรายการชำระเงิน — รูปเดียวเก็บเป็น data URL ตรงๆ (แบบเดิม) หลายรูปเก็บเป็นอาร์เรย์ JSON */
export function parseSlipUrls(raw: string | null | undefined): string[] {
  if (!raw) return [];
  if (raw.startsWith("[")) {
    try {
      const parsed: unknown = JSON.parse(raw);
      if (Array.isArray(parsed)) return parsed.filter((u): u is string => typeof u === "string" && u.length > 0);
    } catch {
      // data URL ไม่มีทางขึ้นต้นด้วย "[" จึงถือว่าเป็นค่าเสียหาย ตกไปใช้ค่าเดิมทั้งก้อนด้านล่าง
    }
  }
  return [raw];
}

export function encodeSlipUrls(urls: string[]): string | null {
  if (urls.length === 0) return null;
  return urls.length === 1 ? urls[0] : JSON.stringify(urls);
}
