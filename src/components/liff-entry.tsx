"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { liffBootstrap } from "@/app/actions/liff";
import { useLiff, LiffGate, handleLiffAuthExpiry } from "@/components/liff-provider";
import { useI18n } from "@/components/i18n-provider";

/** เช็ค lineUserId อัตโนมัติทันทีที่เข้ามา ไม่ให้ลูกค้าเลือกเองว่าใหม่/เก่า —
 * เจอในระบบแล้ว → ไปหน้าจองเลย, ยังไม่เจอ → ไปหน้าลงทะเบียนเลย
 * (ทางเลือก "เคยเป็นลูกค้าอยู่แล้ว" ค้นด้วยเบอร์โทร ยังเข้าถึงได้ผ่านลิงก์เล็กๆ ในหน้าลงทะเบียน) */
function EntryBody() {
  const { t } = useI18n();
  const router = useRouter();
  const { idToken } = useLiff();

  useEffect(() => {
    if (!idToken) return;
    let active = true;
    (async () => {
      const res = await liffBootstrap(idToken);
      if (!active) return;
      if (!res.ok) {
        handleLiffAuthExpiry(res);
        router.replace("/liff/register");
        return;
      }
      router.replace(res.linked ? "/liff/book" : "/liff/register");
    })();
    return () => {
      active = false;
    };
  }, [idToken, router]);

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
