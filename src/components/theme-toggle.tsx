"use client";

import { useTheme } from "next-themes";
import { Sun, Moon } from "lucide-react";
import { useI18n } from "@/components/i18n-provider";
import { Button } from "@/components/ui/button";

export function ThemeToggle() {
  const { resolvedTheme, setTheme } = useTheme();
  const { t } = useI18n();
  const isDark = resolvedTheme === "dark";

  return (
    <Button
      variant="ghost"
      size="icon"
      onClick={() => setTheme(isDark ? "light" : "dark")}
    >
      {/* theme ยังไม่รู้ค่าจริงจนกว่าจะ hydrate ฝั่ง client — ปล่อยให้ต่างจาก server ได้ในจุดนี้ */}
      <span suppressHydrationWarning>
        {isDark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
      </span>
      <span className="sr-only">{t.theme.toggleSr}</span>
    </Button>
  );
}
