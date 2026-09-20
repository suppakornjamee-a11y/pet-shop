/**
 * คำนำหน้าบันทึกกิจกรรมตอนพนักงานปฏิเสธคิว — เหตุผลเก็บต่อท้ายคำนี้ใน OrderActivityLog
 *
 * ใช้ร่วมกันทั้งตอนเขียน (rejectOrderQueue) และตอนอ่านกลับไปแสดงบนหน้าลูกค้า (getLiffOrderPaymentStatus)
 * ถ้าเปลี่ยนคำนี้ที่เดียว ทั้งสองฝั่งเปลี่ยนตาม ไม่เกิดกรณีเขียนคำหนึ่งแต่ไปค้นหาอีกคำ
 */
export const QUEUE_REJECT_LOG_PREFIX = "ปฏิเสธคิว: ";

/**
 * บันทึกกิจกรรมตอนส่ง LINE แจ้งเตือนล่วงหน้า 1 วันของออเดอร์โรงแรม — ใช้เป็นเครื่องหมายว่า "ส่งไปแล้ว"
 * งานรายวันเช็คคำนี้ก่อนส่งทุกครั้ง ถ้ารันซ้ำ (Vercel retry / กดรันเอง) ลูกค้าจะไม่ได้ข้อความซ้ำ
 * และพนักงานเห็นในประวัติการทำรายการว่าส่งแจ้งเตือนไปแล้วเมื่อไหร่
 */
export const CHECKIN_REMINDER_LOG = "ส่ง LINE คอนเฟิร์มเช็คอินล่วงหน้า 1 วัน";
export const CHECKOUT_REMINDER_LOG = "ส่ง LINE คอนเฟิร์มเช็คเอาท์ล่วงหน้า 1 วัน";

/**
 * เครื่องหมาย "ส่งแล้ว" ของ LINE เตือนนัดล่วงหน้า 1 วัน (อาบน้ำ/บริการอื่น) — ผูกกับวันนัดไว้ในข้อความ
 * รันซ้ำวันเดิมไม่ส่งซ้ำ แต่ถ้าร้านย้ายนัดไปวันอื่น วันนัดใหม่จะไม่ตรงกับเครื่องหมายเดิม จึงเตือนรอบใหม่ให้เอง
 */
export const APPOINTMENT_REMINDER_LOG_PREFIX = "ส่ง LINE เตือนนัดล่วงหน้า 1 วัน";
export const appointmentReminderLog = (appointmentDate: string) =>
  `${APPOINTMENT_REMINDER_LOG_PREFIX} (${appointmentDate})`;

/** ต่อท้ายบันทึกกิจกรรมเมื่อพนักงานเพิ่มบริการ/ค่าใช้จ่ายระหว่างทำงาน — ยืนยันว่าลูกค้ารับทราบและยินยอมแล้ว */
export const CUSTOMER_CONFIRMED_LOG_SUFFIX = " — ลูกค้ายืนยันแล้ว";

/** บันทึกกิจกรรมตอนระบบลบรูปตัวอย่างทรงขนที่ครบกำหนดเก็บ */
export const STYLE_IMAGES_PURGED_LOG = "ลบรูปตัวอย่างทรงขนอัตโนมัติ (ครบ 30 วันนับจากวันที่ลูกค้าอัปโหลด)";

/**
 * ผลตรวจข้อมูลยาเห็บหมัดตอนลูกค้าจอง — ระดับ (เขียว/เหลือง/แดง) อยู่ในวงเล็บเหลี่ยมให้หน้าออเดอร์อ่านกลับได้
 * เขียนที่ createBookingRequest อ่านที่หน้าออเดอร์ฝั่งพนักงาน (ไม่มีคอลัมน์แยก จึงใช้รูปแบบข้อความนี้ร่วมกัน)
 */
export const FLEA_CHECK_LOG_PREFIX = "ตรวจยาเห็บหมัดตอนจอง";
export type FleaCheckLogLevel = "GREEN" | "YELLOW" | "RED";
/** ชื่อระดับที่พนักงานเห็นในประวัติออเดอร์ (ใช้คำไทยให้อ่านเข้าใจได้ทันที) */
const FLEA_LEVEL_WORD: Record<FleaCheckLogLevel, string> = { GREEN: "เขียว", YELLOW: "เหลือง", RED: "แดง" };
export const fleaCheckLog = (level: FleaCheckLogLevel, text: string) =>
  `${FLEA_CHECK_LOG_PREFIX} [${FLEA_LEVEL_WORD[level]}]: ${text}`;
export function parseFleaCheckLog(action: string): { level: FleaCheckLogLevel; text: string } | null {
  for (const level of Object.keys(FLEA_LEVEL_WORD) as FleaCheckLogLevel[]) {
    const head = `${FLEA_CHECK_LOG_PREFIX} [${FLEA_LEVEL_WORD[level]}]: `;
    if (action.startsWith(head)) return { level, text: action.slice(head.length) };
  }
  return null;
}

/** พนักงานตรวจข้อมูล/หลักฐานยาเห็บหมัดของออเดอร์นี้แล้ว (ตอนเช็คคิว) */
export const FLEA_STAFF_CHECKED_LOG = "พนักงานตรวจสอบข้อมูลยาเห็บหมัดแล้ว";
/** พนักงานขอข้อมูลยาเห็บหมัดเพิ่มจากลูกค้าทาง LINE — ข้อความที่ส่งต่อท้ายคำนี้ */
export const FLEA_INFO_REQUEST_LOG_PREFIX = "ขอข้อมูลยาเห็บหมัดเพิ่มเติมจากลูกค้า: ";
