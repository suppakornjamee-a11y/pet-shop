"use client";

import { createContext, useContext, useMemo } from "react";
import { useRouter } from "next/navigation";
import type { Locale } from "@/i18n/config";
import type { Dictionary } from "@/i18n/dictionaries/th";
import { getDictionary } from "@/i18n/get-dictionary";
import { setLocale as setLocaleAction } from "@/app/actions/locale";

type I18nContextValue = {
  locale: Locale;
  t: Dictionary;
  setLocale: (locale: Locale) => void;
};

const I18nContext = createContext<I18nContextValue | null>(null);

export function I18nProvider({
  locale,
  children,
}: {
  locale: Locale;
  children: React.ReactNode;
}) {
  const router = useRouter();

  // dictionary มีฟังก์ชันอยู่ข้างใน ส่งข้าม Server → Client Component ตรงๆ ไม่ได้
  // จึงส่งแค่ locale (string) มา แล้ว resolve dictionary เองฝั่ง client
  const value = useMemo<I18nContextValue>(
    () => ({
      locale,
      t: getDictionary(locale),
      setLocale: (next) => {
        void setLocaleAction(next).then(() => {
          // ให้ Server Component ทุกตัว fetch ใหม่ตาม locale ใหม่ โดยไม่ reload ทั้งหน้า
          // (window.location.reload() ทำให้ next-themes hydrate ซ้ำแล้วชน hydration mismatch)
          router.refresh();
        });
      },
    }),
    [locale, router]
  );

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n() {
  const ctx = useContext(I18nContext);
  if (!ctx) throw new Error("useI18n must be used within I18nProvider");
  return ctx;
}
