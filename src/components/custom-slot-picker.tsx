"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Clock3, ArrowRight } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

export function CustomSlotPicker({
  date,
  customerId,
}: {
  date: string;
  customerId?: string;
}) {
  const router = useRouter();
  const [time, setTime] = useState("09:30");

  function go() {
    if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(time)) return;
    // จองย้อนหลังไม่ได้
    if (new Date(`${date}T${time}:00+07:00`).getTime() < Date.now()) {
      toast.error("จองคิวย้อนหลังไม่ได้ กรุณาเลือกเวลาในอนาคต");
      return;
    }
    const cq = customerId ? `&customerId=${customerId}` : "";
    router.push(`/orders/new?date=${date}&time=${time}${cq}`);
  }

  return (
    <div className="flex items-center gap-2 rounded-lg border border-dashed bg-muted/30 px-3 py-2.5">
      <Clock3 className="h-4 w-4 shrink-0 text-primary" />
      <span className="text-sm text-muted-foreground">กำหนดเวลาเอง</span>
      <Input
        type="time"
        value={time}
        onChange={(e) => setTime(e.target.value)}
        className="h-8 w-[110px]"
      />
      <Button size="sm" className="ml-auto" onClick={go}>
        <ArrowRight /> สร้างออเดอร์
      </Button>
    </div>
  );
}
