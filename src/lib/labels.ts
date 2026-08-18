import type { Species, OrderStatus, PaymentStatus } from "@/generated/prisma/enums";

export const speciesEmoji: Record<Species, string> = {
  DOG: "🐶",
  CAT: "🐱",
};

const FLEA_TICK_STALE_MS = 30 * 24 * 60 * 60 * 1000; // 30 วัน

/** เห็บ/หมัดควรตรวจเช็คซ้ำหรือยัง — ไม่เคยบันทึก หรือเกิน 30 วันนับจากล่าสุด */
export function isFleaTickCheckStale(lastFleaTickAt: Date | null): boolean {
  if (!lastFleaTickAt) return true;
  return Date.now() - lastFleaTickAt.getTime() > FLEA_TICK_STALE_MS;
}

// Tailwind classes for status badges
export const orderStatusColor: Record<OrderStatus, string> = {
  PENDING_PAYMENT: "bg-amber-100 text-amber-800 border-amber-200 dark:bg-amber-950 dark:text-amber-300 dark:border-amber-900",
  DEPOSIT_PAID: "bg-teal-100 text-teal-800 border-teal-200 dark:bg-teal-950 dark:text-teal-300 dark:border-teal-900",
  PAID: "bg-sky-100 text-sky-800 border-sky-200 dark:bg-sky-950 dark:text-sky-300 dark:border-sky-900",
  IN_PROGRESS: "bg-orange-100 text-orange-800 border-orange-200 dark:bg-orange-950 dark:text-orange-300 dark:border-orange-900",
  COMPLETED: "bg-emerald-100 text-emerald-800 border-emerald-200 dark:bg-emerald-950 dark:text-emerald-300 dark:border-emerald-900",
  CANCELLED: "bg-rose-100 text-rose-800 border-rose-200 dark:bg-rose-950 dark:text-rose-300 dark:border-rose-900",
};

export const paymentStatusColor: Record<PaymentStatus, string> = {
  PENDING: "bg-amber-100 text-amber-800 border-amber-200 dark:bg-amber-950 dark:text-amber-300 dark:border-amber-900",
  SUBMITTED: "bg-sky-100 text-sky-800 border-sky-200 dark:bg-sky-950 dark:text-sky-300 dark:border-sky-900",
  VERIFIED: "bg-emerald-100 text-emerald-800 border-emerald-200 dark:bg-emerald-950 dark:text-emerald-300 dark:border-emerald-900",
  REJECTED: "bg-rose-100 text-rose-800 border-rose-200 dark:bg-rose-950 dark:text-rose-300 dark:border-rose-900",
  EXPIRED: "bg-zinc-100 text-zinc-600 border-zinc-200 dark:bg-zinc-900 dark:text-zinc-400 dark:border-zinc-800",
};
