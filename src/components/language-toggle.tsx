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

/* ธงวาดเป็น SVG เอง ไม่ใช้อิโมจิธง เพราะ Windows ไม่รองรับ จะกลายเป็นตัวอักษร "TH"/"GB" แทนรูปธง */

function ThaiFlag({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 60 40" className={className} aria-hidden>
      <rect width="60" height="40" fill="#A51931" />
      <rect y="6.67" width="60" height="26.66" fill="#F4F5F8" />
      <rect y="13.33" width="60" height="13.34" fill="#2D2A4A" />
    </svg>
  );
}

function UkFlag({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 60 40" className={className} aria-hidden>
      <rect width="60" height="40" fill="#012169" />
      <path d="M0,0 L60,40 M60,0 L0,40" stroke="#FFFFFF" strokeWidth="9" />
      <path d="M0,0 L60,40 M60,0 L0,40" stroke="#C8102E" strokeWidth="4" />
      <path d="M30,0 V40 M0,20 H60" stroke="#FFFFFF" strokeWidth="13" />
      <path d="M30,0 V40 M0,20 H60" stroke="#C8102E" strokeWidth="7" />
    </svg>
  );
}

// กล่องธงต้องเป็นอัตราส่วน 3:2 เท่ากับ viewBox ของ SVG (60x40) พอดี
// ไม่งั้น SVG จะย่อให้พอดีกรอบแล้วเหลือขอบว่างบน-ล่าง (21x14 = 3:2)
const FLAG_CLASS = "block h-3.5 w-[21px] shrink-0 rounded-[2px] ring-1 ring-black/10";

export function LanguageToggle() {
  const { locale, t, setLocale } = useI18n();

  const options = [
    { value: "th" as const, short: "TH", Flag: ThaiFlag },
    { value: "en" as const, short: "EN", Flag: UkFlag },
  ];
  const current = options.find((o) => o.value === locale) ?? options[0];

  return (
    <DropdownMenu>
      <DropdownMenuTrigger render={<Button variant="ghost" size="sm" className="gap-1.5 px-2" />}>
        <current.Flag className={FLAG_CLASS} />
        <span className="text-xs font-semibold">{current.short}</span>
        <span className="sr-only">{t.language.toggleSr}</span>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-28">
        {options.map((o) => (
          <DropdownMenuItem key={o.value} onClick={() => setLocale(o.value)}>
            <o.Flag className={FLAG_CLASS} />
            <span className={cn("flex-1 text-sm", o.value === locale && "font-semibold")}>
              {o.short}
            </span>
            {o.value === locale && <Check className="h-3.5 w-3.5" />}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
