"use client";

import { createContext, useContext, useEffect, useState } from "react";
import { Loader2, AlertTriangle } from "lucide-react";
import { useI18n } from "@/components/i18n-provider";

type LiffState = {
  ready: boolean;
  inClient: boolean;
  idToken: string | null;
  displayName: string | null;
  error: string | null;
  /** ข้อความ error ดิบจาก LIFF SDK — โชว์แบบเล็กๆ ไว้ช่วย debug ตอนทดสอบ ไม่ได้ตั้งใจให้ลูกค้าเห็นเป็นหลัก */
  debugDetail: string | null;
};

const LiffContext = createContext<LiffState | null>(null);

/**
 * เริ่มต้น LIFF SDK ครั้งเดียวตอนโหลดหน้า /liff/* — ทุกหน้าลูกอ่าน idToken จาก context นี้
 * แล้วส่งแนบไปกับทุกครั้งที่เรียก src/app/actions/liff.ts (เซิร์ฟเวอร์ verify ซ้ำทุกครั้ง ไม่เชื่อ token
 * ที่เก็บไว้เฉยๆ) โหลด @line/liff แบบ dynamic import ในนี้เท่านั้น เพราะแตะ window/localStorage
 * ตอน init ซึ่งพังถ้าโดนรันตอน server render (เหมือนที่ payment-panel.tsx ทำกับ qrcode)
 */
export function LiffProvider({ children }: { children: React.ReactNode }) {
  const { t } = useI18n();
  const [state, setState] = useState<LiffState>({
    ready: false,
    inClient: false,
    idToken: null,
    displayName: null,
    error: null,
    debugDetail: null,
  });

  useEffect(() => {
    let cancelled = false;
    // กัน liff.init() ค้างไม่ resolve เลย (เจอได้จริงถ้า browser บล็อก third-party cookie/storage) —
    // ไม่งั้นจอจะหมุนโหลดค้างตลอดไปโดยไม่มีเบาะแสอะไรให้ debug เลย
    const timeoutId = setTimeout(() => {
      if (!cancelled) {
        setState((s) =>
          s.ready
            ? s
            : { ...s, error: `${t.liff.errorTitle} — ${t.liff.errorHint}`, debugDetail: "liff.init() timeout (>12s)" }
        );
      }
    }, 12000);

    (async () => {
      const liffId = process.env.NEXT_PUBLIC_LINE_LIFF_ID;
      if (!liffId) {
        if (!cancelled) setState((s) => ({ ...s, error: t.liff.notConfiguredNotice }));
        return;
      }
      try {
        const { default: liff } = await import("@line/liff");
        await liff.init({ liffId, withLoginOnExternalBrowser: true });
        if (cancelled) return;
        if (!liff.isLoggedIn()) {
          liff.login();
          return; // liff.login() จะ redirect ออกไปหน้า LINE login แล้วเด้งกลับมาเอง
        }
        const idToken = liff.getIDToken();
        const decoded = liff.getDecodedIDToken();
        if (!cancelled) {
          clearTimeout(timeoutId);
          setState({
            ready: true,
            inClient: liff.isInClient(),
            idToken,
            displayName: decoded?.name ?? null,
            error: null,
            debugDetail: null,
          });
        }
      } catch (e) {
        clearTimeout(timeoutId);
        if (!cancelled) {
          setState((s) => ({
            ...s,
            error: `${t.liff.errorTitle} — ${t.liff.errorHint}`,
            debugDetail: e instanceof Error ? `${e.name}: ${e.message}` : String(e),
          }));
        }
      }
    })();
    return () => {
      cancelled = true;
      clearTimeout(timeoutId);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- t เปลี่ยนได้ตามภาษา แต่ไม่ต้องการรัน liff.init() ซ้ำ
  }, []);

  return <LiffContext.Provider value={state}>{children}</LiffContext.Provider>;
}

export function useLiff() {
  const ctx = useContext(LiffContext);
  if (!ctx) throw new Error("useLiff ต้องถูกเรียกภายใน <LiffProvider> เท่านั้น");
  return ctx;
}

/**
 * เรียกทุกครั้งที่ได้ผลลัพธ์ ok:false กลับมาจาก src/app/actions/liff.ts (นอกเหนือจากการโชว์
 * error ตามปกติที่แต่ละหน้าทำอยู่แล้ว) — ถ้าเป็นกรณีโทเค็นหมดอายุ (code: "LIFF_AUTH_EXPIRED")
 * จะ reload หน้าให้เองอัตโนมัติหลังจากนั้นสักครู่ เพื่อขอเซสชันใหม่ แทนที่จะปล่อยให้ผู้ใช้ค้างอยู่
 * ที่ error ต้องปิดแอปเปิดใหม่เอง คืน true ถ้าเป็นกรณีนี้ (ไว้เผื่อผู้เรียกอยากข้ามการโชว์ error ปกติ)
 */
export function handleLiffAuthExpiry(res: { code?: string }): boolean {
  if (res.code !== "LIFF_AUTH_EXPIRED") return false;
  setTimeout(() => window.location.reload(), 1500);
  return true;
}

/** จอโหลด/error กลางเดียวกัน ใช้ซ้ำได้ทุกหน้าใน /liff — เรียกก่อนเรนเดอร์เนื้อหาจริงเสมอ
 * คืน null ถ้าพร้อมใช้งานแล้ว (idToken มีค่า) แปลว่าหน้าควรเรนเดอร์เนื้อหาจริงต่อได้เลย */
export function LiffGate({ children }: { children: React.ReactNode }) {
  const { t } = useI18n();
  const { ready, idToken, error, debugDetail } = useLiff();

  if (error) {
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center gap-3 p-6 text-center">
        <AlertTriangle className="h-10 w-10 text-destructive" />
        <p className="font-medium">{t.liff.errorTitle}</p>
        <p className="text-sm text-muted-foreground">{error}</p>
        {debugDetail && (
          <p className="mt-2 max-w-full break-words rounded-md bg-muted/50 px-3 py-2 font-mono text-[11px] text-muted-foreground">
            {debugDetail}
          </p>
        )}
      </div>
    );
  }
  if (!ready || !idToken) {
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center gap-3 p-6 text-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <p className="text-sm text-muted-foreground">{t.liff.loadingTitle}</p>
      </div>
    );
  }
  return <>{children}</>;
}
