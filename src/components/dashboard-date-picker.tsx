"use client";

import { useRouter } from "next/navigation";
import { CalendarDays } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

export function DashboardDatePicker({ value }: { value: string }) {
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
        <CalendarDays className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          type="date"
          value={value}
          onChange={(e) => router.push(`/?date=${e.target.value}`)}
          className="w-[180px] pl-8"
        />
      </div>
      {value !== todayStr() && (
        <Button variant="outline" size="sm" onClick={() => router.push("/")}>
          วันนี้
        </Button>
      )}
    </div>
  );
}
