"use client";

import { useRouter } from "next/navigation";
import { todayThaiStr } from "@/lib/slots";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useI18n } from "@/components/i18n-provider";

/** ตัวเลือกวันที่แบบใช้ร่วมกันได้ทุกหน้า — เปลี่ยนวันแล้วยิง query string ใหม่
 * (ค่าอื่นที่ต้องคงไว้ เช่น ตัวกรองสถานะ ส่งมาทาง keepParams) */
export function DateFilter({
  value,
  basePath = "/",
  keepParams,
}: {
  value: string;
  basePath?: string;
  keepParams?: Record<string, string | undefined>;
}) {
  const { t } = useI18n();
  const router = useRouter();

  function buildHref(date?: string) {
    const params = new URLSearchParams();
    for (const [k, v] of Object.entries(keepParams ?? {})) {
      if (v) params.set(k, v);
    }
    if (date) params.set("date", date);
    const qs = params.toString();
    return qs ? `${basePath}?${qs}` : basePath;
  }

  return (
    <div className="flex items-center gap-2">
      <Input
        type="date"
        value={value}
        onChange={(e) => router.push(buildHref(e.target.value))}
        className="w-[180px]"
      />
      {value !== todayThaiStr() && (
        <Button variant="outline" size="sm" onClick={() => router.push(buildHref())}>
          {t.calendar.todayLabel}
        </Button>
      )}
    </div>
  );
}
