/**
 * สัญญาณบอกกระดิ่งแจ้งเตือนว่า "งานที่ค้างอยู่เพิ่งเปลี่ยน ไปถามใหม่เดี๋ยวนี้เลย"
 *
 * กระดิ่งเป็น client component ที่เก็บตัวเลขไว้ใน state ของตัวเอง — router.refresh()
 * โหลดเฉพาะ server component ใหม่ ไม่ได้แตะ state ตัวนี้ ถ้าไม่มีสัญญาณนี้ พนักงานกด
 * ยืนยันคิว/ยืนยันสลิปเสร็จแล้วตัวเลขบนกระดิ่งจะยังค้างอยู่จนกว่าจะครบรอบถาม 30 วินาที
 */
const EVENT = "staff-alerts:changed";

/** เรียกหลังพนักงานทำงานที่ทำให้รายการค้างหายไป (ยืนยัน/ปฏิเสธคิว, ยืนยัน/ปฏิเสธสลิป, เปลี่ยนสถานะ) */
export function notifyStaffAlertsChanged() {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new Event(EVENT));
}

/** ให้กระดิ่งสมัครฟัง — คืนฟังก์ชันสำหรับยกเลิกการฟัง */
export function onStaffAlertsChanged(handler: () => void) {
  if (typeof window === "undefined") return () => {};
  window.addEventListener(EVENT, handler);
  return () => window.removeEventListener(EVENT, handler);
}
