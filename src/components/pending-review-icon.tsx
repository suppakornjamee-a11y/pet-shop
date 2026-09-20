import { cn } from "@/lib/utils";

/** ไอคอน "รอตรวจสอบ" ของระบบหลังบ้าน (นาฬิกาพร้อมลูกศรหมุน) — ใช้คู่กับข้อความสถานะเสมอ จึงไม่ใส่ alt */
export function PendingReviewIcon({ className }: { className?: string }) {
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img src="/images/icons/pending-review.png" alt="" aria-hidden className={cn("h-4 w-4 shrink-0", className)} />
  );
}

/** สถานะ "รอตรวจสอบ" แบบไอคอน + ข้อความสีเหลืองอำพัน — ใช้ทุกที่ในระบบหลังบ้านที่โชว์สถานะรอตรวจสอบ */
export function PendingReviewMark({ children, size = "sm" }: { children: string; size?: "sm" | "xs" }) {
  return (
    <span className="inline-flex items-center gap-[7px]">
      <PendingReviewIcon className={size === "xs" ? "h-3 w-3" : undefined} />
      <span className={cn("font-medium text-amber-700 dark:text-amber-400", size === "xs" ? "text-[10px]" : "text-xs")}>
        {children}
      </span>
    </span>
  );
}
