"use client";

import { useRouter } from "next/navigation";
import { useI18n } from "@/components/i18n-provider";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

/** เลือกช่วงวันที่ของรายงาน — เก็บไว้ใน query string จะได้แชร์ลิงก์/รีเฟรชแล้วช่วงเดิมยังอยู่ */
export function ReportRangePicker({ from, to }: { from: string; to: string }) {
  const { t } = useI18n();
  const router = useRouter();

  const go = (nextFrom: string, nextTo: string) =>
    router.push(`/reports?from=${nextFrom}&to=${nextTo}`);

  /** ช่วงย้อนหลัง n วันนับถึงวันนี้ (รวมวันนี้) */
  function lastDays(n: number) {
    const today = new Date();
    const start = new Date(today.getTime() - (n - 1) * 86_400_000);
    const fmt = (d: Date) =>
      `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
    go(fmt(start), fmt(today));
  }

  function thisMonth() {
    const d = new Date();
    const first = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-01`;
    const today = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
    go(first, today);
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
