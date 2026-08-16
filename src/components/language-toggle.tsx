"use client";

import { Languages } from "lucide-react";
import { useI18n } from "@/components/i18n-provider";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export function LanguageToggle() {
  const { locale, t, setLocale } = useI18n();

  return (
    <DropdownMenu>
      <DropdownMenuTrigger render={<Button variant="ghost" size="icon" />}>
        <Languages className="h-4 w-4" />
        <span className="sr-only">{t.language.toggleSr}</span>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-32">
        <DropdownMenuItem onClick={() => setLocale("th")} data-active={locale === "th"}>
          <span className={locale === "th" ? "font-semibold" : undefined}>{t.language.th}</span>
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => setLocale("en")} data-active={locale === "en"}>
          <span className={locale === "en" ? "font-semibold" : undefined}>{t.language.en}</span>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
