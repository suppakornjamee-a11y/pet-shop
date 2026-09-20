/** ข้อความยืนยันการจองอาบน้ำเมื่อรับมัดจำแล้ว (คำขอจองจาก LINE) — แก้ถ้อยคำที่นี่ที่เดียว */
export function buildBookingConfirmedText(p: {
  petName: string | null;
  date: string;
  time: string;
  depositAmount: number;
}): string {
  return `ยืนยันการจองของน้อง${p.petName ?? ""} วันที่ ${p.date} เวลา ${p.time} น. เรียบร้อยแล้วค่ะ รับมัดจำแล้ว ${p.depositAmount.toLocaleString("th-TH")} บาท ซึ่งจะนำไปหักจากค่าบริการทั้งหมด โดยสรุปราคาสุทธิหลังอาบน้ำเสร็จ แล้วพบกันค่ะ`;
}
