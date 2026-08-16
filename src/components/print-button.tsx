"use client";

import { useEffect } from "react";
import { Printer } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useI18n } from "@/components/i18n-provider";

export function PrintButton({ auto = false }: { auto?: boolean }) {
  const { t } = useI18n();
  useEffect(() => {
    if (auto) {
      const timeoutId = setTimeout(() => window.print(), 600);
      return () => clearTimeout(timeoutId);
    }
  }, [auto]);

  return (
    <Button onClick={() => window.print()} className="print:hidden">
      <Printer /> {t.print.printBtn}
    </Button>
  );
}
