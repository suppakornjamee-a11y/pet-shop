/**
 * โลโก้ธนาคารไทย — คู่กับรายชื่อธนาคารในฟอร์มเพิ่มบัญชี (THAI_BANKS)
 *
 * เก็บเป็นรายการเดียวทั้งชื่อและโลโก้ เพื่อไม่ให้ลิสต์สองที่หลุดกัน
 * เวลาเพิ่มธนาคารใหม่ต้องแก้ที่นี่ที่เดียว แล้วฟอร์มกับการ์ดจะได้ตามไปเอง
 */
export type ThaiBank = { name: string; logo: string };

export const THAI_BANKS: ThaiBank[] = [
  { name: "กรุงเทพ", logo: "/images/banks/bbl.png" },
  { name: "กรุงไทย", logo: "/images/banks/ktb.png" },
  { name: "กรุงศรีอยุธยา", logo: "/images/banks/bay.png" },
  { name: "กสิกรไทย", logo: "/images/banks/kbank.png" },
  { name: "เกียรตินาคินภัทร", logo: "/images/banks/kkp.png" },
  { name: "ซีไอเอ็มบี ไทย", logo: "/images/banks/cimb.png" },
  { name: "ทหารไทยธนชาต", logo: "/images/banks/ttb.png" },
  { name: "ไทยพาณิชย์", logo: "/images/banks/scb.png" },
  { name: "เพื่อการเกษตรและสหกรณ์การเกษตร (ธ.ก.ส.)", logo: "/images/banks/baac.png" },
  { name: "ยูโอบี", logo: "/images/banks/uob.png" },
  { name: "แลนด์ แอนด์ เฮ้าส์", logo: "/images/banks/lhb.png" },
  { name: "ออมสิน", logo: "/images/banks/gsb.png" },
  { name: "อาคารสงเคราะห์", logo: "/images/banks/ghb.png" },
  { name: "อิสลามแห่งประเทศไทย", logo: "/images/banks/ibank.png" },
  { name: "ไอซีบีซี (ไทย)", logo: "/images/banks/icbc.png" },
];

export const THAI_BANK_NAMES: readonly string[] = THAI_BANKS.map((b) => b.name);

/**
 * หาโลโก้จากชื่อธนาคารที่บันทึกไว้ — คืน null ถ้าไม่ตรงกับธนาคารที่รู้จัก
 * (พนักงานพิมพ์ชื่อเองได้ผ่านตัวเลือก "อื่นๆ" จึงต้องเผื่อกรณีไม่มีโลโก้ไว้เสมอ)
 */
export function bankLogoFor(bankName: string | null | undefined): string | null {
  if (!bankName) return null;
  const key = bankName.trim();
  return THAI_BANKS.find((b) => b.name === key)?.logo ?? null;
}
