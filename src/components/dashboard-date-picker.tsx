"use client";

import { useRouter } from "next/navigation";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useI18n } from "@/components/i18n-provider";

export function DashboardDatePicker({ value }: { value: string }) {
  const { t } = useI18n();
  const router = useRouter();

  function todayStr() {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(
      d.getDate()
    ).padStart(2, "0")}`;
  }

  return (
    <div className="flex items-center gap-2">
      <div className="relative">
        <Input
          type="date"
          value={value}
          onChange={(e) => router.push(`/?date=${e.target.value}`)}
          className="w-[180px]"
        />
      </div>
      {value !== todayStr() && (
        <Button variant="outline" size="sm" onClick={() => router.push("/")}>
          {t.calendar.todayLabel}
        </Button>
      )}
    </div>
  );
}
