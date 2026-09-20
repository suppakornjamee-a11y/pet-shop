/**
 * อายุสัตว์เลี้ยงเป็นปี + เดือน จากวันเกิด (YYYY-MM-DD) ถึงวันที่กำหนด (YYYY-MM-DD)
 * ครบเดือนเมื่อถึงวันที่เดียวกันของเดือนถัดไป — วันเกิดในอนาคตหรือรูปแบบวันที่ผิดคืน null
 */
export function petAge(birthDate: string, today: string): { years: number; months: number } | null {
  const shape = /^\d{4}-\d{2}-\d{2}$/;
  if (!shape.test(birthDate) || !shape.test(today) || birthDate > today) return null;
  const [by, bm, bd] = birthDate.split("-").map(Number);
  const [ty, tm, td] = today.split("-").map(Number);
  let totalMonths = (ty - by) * 12 + (tm - bm);
  if (td < bd) totalMonths -= 1;
  return { years: Math.floor(totalMonths / 12), months: totalMonths % 12 };
}
