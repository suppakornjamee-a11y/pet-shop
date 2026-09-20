import { computeFleaTickStatus, type FleaTickProductInfo, type Species } from "@/lib/flea-tick";
import { formatDate } from "@/lib/format";
import { thaiDayRange } from "@/lib/slots";
import { cn } from "@/lib/utils";
import type { Dictionary } from "@/i18n/dictionaries/th";

const TONE = {
  COVERED: "bg-emerald-100 text-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-300",
  DUE_BEFORE_SERVICE: "bg-rose-100 text-rose-700 dark:bg-rose-950/50 dark:text-rose-300",
  INCOMPLETE: "bg-amber-100 text-amber-800 dark:bg-amber-950/50 dark:text-amber-300",
} as const;

/**
 * สถานะยาเห็บหมัดของสัตว์เลี้ยงเทียบกับวันบริการ — ใช้ข้อมูลสัตว์เลี้ยงปัจจุบัน (ลูกค้าอัปเดตแล้วเห็นทันที)
 * แสดงแหล่งที่มาของข้อมูลเสมอ ให้พนักงานรู้ว่าเป็นแค่ที่ลูกค้าแจ้ง หรือเห็นหลักฐานแล้ว
 * ผ่านเกณฑ์ไม่ได้แปลว่าปลอดเห็บหมัด — พนักงานยังต้องตรวจตอนรับบริการจริง
 *
 * alwaysShow = แสดงแม้สัตว์ยังไม่มีข้อมูลยาเลย (ขึ้นเป็น "ข้อมูลไม่ครบหรือรอตรวจสอบ") — ใช้ตอนพนักงานเช็คคิว
 * เพราะร้านเป็นคนตรวจยาเห็บหมัดตอนนั้น จะได้ไม่พลาดกรณีลูกค้าไม่ได้กรอกอะไรมาเลย
 */
export function FleaTickStatusBlock({
  t,
  pet,
  serviceDate,
  alwaysShow = false,
  className,
}: {
  t: Dictionary;
  pet: {
    species: Species;
    lastFleaTickAt: Date | null;
    fleaTickMedicine: string | null;
    fleaTickSource: "CUSTOMER" | "STAFF_CHECKED";
    fleaTickProduct: FleaTickProductInfo | null;
  };
  serviceDate: string;
  alwaysShow?: boolean;
  className?: string;
}) {
  const hasData = !!(pet.lastFleaTickAt || pet.fleaTickMedicine || pet.fleaTickProduct);
  if (!hasData && !alwaysShow) return null;
  const status = computeFleaTickStatus({
    givenAt: pet.lastFleaTickAt,
    product: pet.fleaTickProduct,
    petSpecies: pet.species,
    serviceDate,
  });

  // ผ่านแล้วแสดงเป็นตราที่หัวข้อ "ยาเห็บหมัด" แทน จึงไม่ต้องมีป้ายสถานะซ้ำตรงนี้ · ป้ายแสดงเฉพาะที่ต้องให้ความสนใจ
  const showStatusPill = status.kind !== "COVERED";
  const showSourcePill = hasData && pet.fleaTickSource === "STAFF_CHECKED";

  return (
    <div className={cn("mt-1.5 space-y-1 text-xs", className)}>
      {(showStatusPill || showSourcePill) && (
        <div className="flex flex-wrap items-center gap-1.5">
          {showStatusPill && (
            <span className={cn("rounded-full px-2 py-0.5 font-medium", TONE[status.kind])}>
              {t.fleaTick.status[status.kind]}
            </span>
          )}
          {showSourcePill && (
            <span className="rounded-full border px-2 py-0.5 text-muted-foreground">
              {t.fleaTick.source.STAFF_CHECKED}
            </span>
          )}
        </div>
      )}
      {hasData && (
        <div>
          <div>{t.fleaTick.medicineName(pet.fleaTickProduct?.name ?? pet.fleaTickMedicine ?? "-")}</div>
          {pet.lastFleaTickAt && <div>{t.fleaTick.lastGiven(formatDate(pet.lastFleaTickAt))}</div>}
        </div>
      )}
      {status.nextDueDate && (
        <div>{t.fleaTick.nextDue(formatDate(thaiDayRange(status.nextDueDate).start))}</div>
      )}
      {pet.fleaTickProduct?.bathNote && (
        <div className="text-amber-800 dark:text-amber-300">{pet.fleaTickProduct.bathNote}</div>
      )}
    </div>
  );
}
