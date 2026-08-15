import type {
  Species,
  Gender,
  ServiceCategory,
  RoomSize,
  OrderStatus,
  PaymentStatus,
  ProductTarget,
  BillingUnit,
  PaymentPurpose,
} from "@/generated/prisma/enums";

export const speciesLabel: Record<Species, string> = {
  DOG: "สุนัข",
  CAT: "แมว",
};

export const speciesEmoji: Record<Species, string> = {
  DOG: "🐶",
  CAT: "🐱",
};

export const genderLabel: Record<Gender, string> = {
  MALE: "เพศผู้",
  FEMALE: "เพศเมีย",
  UNKNOWN: "ไม่ระบุ",
};

export const serviceCategoryLabel: Record<ServiceCategory, string> = {
  BATH: "อาบน้ำ",
  GROOMING: "ตัดขน",
  BOARDING: "ฝากเลี้ยง",
  OTHER: "อื่นๆ",
};

export const roomSizeLabel: Record<RoomSize, string> = {
  SMALL: "เล็ก (S)",
  MEDIUM: "กลาง (M)",
  LARGE: "ใหญ่ (L)",
  XLARGE: "ใหญ่พิเศษ (XL)",
};

export const orderStatusLabel: Record<OrderStatus, string> = {
  PENDING_PAYMENT: "รอชำระเงิน",
  DEPOSIT_PAID: "มัดจำแล้ว รอชำระส่วนที่เหลือ",
  PAID: "ชำระแล้ว",
  IN_PROGRESS: "กำลังดำเนินการ",
  COMPLETED: "เสร็จสิ้น",
  CANCELLED: "ยกเลิก",
};

// Tailwind classes for status badges
export const orderStatusColor: Record<OrderStatus, string> = {
  PENDING_PAYMENT: "bg-amber-100 text-amber-800 border-amber-200 dark:bg-amber-950 dark:text-amber-300 dark:border-amber-900",
  DEPOSIT_PAID: "bg-teal-100 text-teal-800 border-teal-200 dark:bg-teal-950 dark:text-teal-300 dark:border-teal-900",
  PAID: "bg-sky-100 text-sky-800 border-sky-200 dark:bg-sky-950 dark:text-sky-300 dark:border-sky-900",
  IN_PROGRESS: "bg-violet-100 text-violet-800 border-violet-200 dark:bg-violet-950 dark:text-violet-300 dark:border-violet-900",
  COMPLETED: "bg-emerald-100 text-emerald-800 border-emerald-200 dark:bg-emerald-950 dark:text-emerald-300 dark:border-emerald-900",
  CANCELLED: "bg-rose-100 text-rose-800 border-rose-200 dark:bg-rose-950 dark:text-rose-300 dark:border-rose-900",
};

export const billingUnitLabel: Record<BillingUnit, string> = {
  PER_NIGHT: "ต่อคืน",
  PER_VISIT: "ต่อครั้ง",
};

export const paymentPurposeLabel: Record<PaymentPurpose, string> = {
  DEPOSIT: "มัดจำ",
  BALANCE: "ยอดคงเหลือ",
};

export const paymentStatusLabel: Record<PaymentStatus, string> = {
  PENDING: "รอชำระ",
  SUBMITTED: "รอตรวจสอบสลิป",
  VERIFIED: "ยืนยันแล้ว",
  REJECTED: "ปฏิเสธ",
  EXPIRED: "หมดอายุ",
};

export const paymentStatusColor: Record<PaymentStatus, string> = {
  PENDING: "bg-amber-100 text-amber-800 border-amber-200 dark:bg-amber-950 dark:text-amber-300 dark:border-amber-900",
  SUBMITTED: "bg-sky-100 text-sky-800 border-sky-200 dark:bg-sky-950 dark:text-sky-300 dark:border-sky-900",
  VERIFIED: "bg-emerald-100 text-emerald-800 border-emerald-200 dark:bg-emerald-950 dark:text-emerald-300 dark:border-emerald-900",
  REJECTED: "bg-rose-100 text-rose-800 border-rose-200 dark:bg-rose-950 dark:text-rose-300 dark:border-rose-900",
  EXPIRED: "bg-zinc-100 text-zinc-600 border-zinc-200 dark:bg-zinc-900 dark:text-zinc-400 dark:border-zinc-800",
};

export const productTargetLabel: Record<ProductTarget, string> = {
  PET: "ของสัตว์",
  HUMAN: "ของคน (คาเฟ่)",
};
