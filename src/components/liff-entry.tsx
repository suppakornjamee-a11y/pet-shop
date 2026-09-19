"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { LiffGate } from "@/components/liff-provider";
import { useI18n } from "@/components/i18n-provider";

/** เข้าหน้าจองทันที — ไม่บังคับไปหน้าลงทะเบียนก่อน (ลูกค้าใหม่กรอกข้อมูลในหน้าจองหลังเลือกบริการ) */
function EntryBody() {
  const { t } = useI18n();
  const router = useRouter();

  useEffect(() => {
    router.replace("/liff/book");
  }, [router]);

  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center gap-3 p-6 text-center">
      <Loader2 className="h-8 w-8 animate-spin text-primary" />
      <p className="text-sm text-muted-foreground">{t.liff.loadingTitle}</p>
    </div>
  );
}

export function LiffEntry() {
  return (
    <LiffGate>
      <EntryBody />
    </LiffGate>
  );
}
