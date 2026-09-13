"use client";

import { Check } from "lucide-react";
import { cn } from "@/lib/utils";
import { useI18n } from "@/components/i18n-provider";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

/* ธงเป็นไฟล์รูป ไม่ใช้อิโมจิธง เพราะ Windows ไม่รองรับ จะกลายเป็นตัวอักษร "TH"/"GB" แทนรูปธง
   รูปทั้งสองถูกครอปเป็นอัตราส่วน 3:2 ไว้แล้ว (120x80) กรอบด้านล่างจึงใช้ 3:2 เท่ากัน ไม่มีขอบว่าง */
const FLAG_CLASS = "block h-3.5 w-[21px] shrink-0 rounded-[2px] object-cover ring-1 ring-black/10";

export function LanguageToggle() {
  const { locale, t, setLocale } = useI18n();

  // ไม่มีตัวหนังสือ TH/EN บนหน้าจอแล้ว — ชื่อภาษาใส่ไว้เป็น alt ให้ screen reader อ่าน
  // เขียนชื่อเป็นภาษาของตัวเอง (ไทย / English) คนที่อ่านอีกภาษาไม่ออกก็ยังหาภาษาของตัวเองเจอ
  const options = [
    { value: "th" as const, name: "ไทย", src: "/images/flags/th.png" },
    { value: "en" as const, name: "English", src: "/images/flags/en.png" },
  ];
  const current = options.find((o) => o.value === locale) ?? options[0];

  return (
    <DropdownMenu>
      <DropdownMenuTrigger render={<Button variant="ghost" size="icon" />}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={current.src} alt={current.name} className={FLAG_CLASS} />
        <span className="sr-only">{t.language.toggleSr}</span>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-auto min-w-0">
        {options.map((o) => (
          <DropdownMenuItem key={o.value} onClick={() => setLocale(o.value)} className="gap-2">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={o.src} alt={o.name} className={FLAG_CLASS} />
            <Check className={cn("h-3.5 w-3.5", o.value !== locale && "invisible")} />
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
