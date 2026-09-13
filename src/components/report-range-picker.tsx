"use client";

import { useRouter } from "next/navigation";
import { useI18n } from "@/components/i18n-provider";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { addDaysThai, toThaiDateStr } from "@/lib/slots";

/** เลือกช่วงวันที่ของรายงาน — เก็บไว้ใน query string จะได้แชร์ลิงก์/รีเฟรชแล้วช่วงเดิมยังอยู่ */
export function ReportRangePicker({ from, to }: { from: string; to: string }) {
  const { t } = useI18n();
  const router = useRouter();

  const go = (nextFrom: string, nextTo: string) =>
    router.push(`/reports?from=${nextFrom}&to=${nextTo}`);

  /** ช่วงย้อนหลัง n วันนับถึงวันนี้ (รวมวันนี้) */
  // นับ "วันนี้" ตามเวลาไทยเสมอ ไม่พึ่งโซนเวลาของเครื่องที่เปิดหน้า
  function lastDays(n: number) {
    const today = toThaiDateStr(new Date());
    go(addDaysThai(today, -(n - 1)), today);
  }

  function thisMonth() {
    const today = toThaiDateStr(new Date());
    go(`${today.slice(0, 8)}01`, today);
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <Button variant="outline" size="sm" onClick={() => lastDays(7)}>
        {t.reports.last7}
      </Button>
      <Button variant="outline" size="sm" onClick={() => lastDays(30)}>
        {t.reports.last30}
      </Button>
      <Button variant="outline" size="sm" onClick={thisMonth}>
        {t.reports.thisMonth}
      </Button>

      <Input
        type="date"
        value={from}
        max={to}
        onChange={(e) => go(e.target.value, to)}
        className="w-[150px]"
        aria-label={t.reports.fromLabel}
      />
      <span className="text-sm text-muted-foreground">–</span>
      <Input
        type="date"
        value={to}
        min={from}
        onChange={(e) => go(from, e.target.value)}
        className="w-[150px]"
        aria-label={t.reports.toLabel}
      />
    </div>
  );
}
