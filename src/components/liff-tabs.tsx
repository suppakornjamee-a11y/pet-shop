"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { CalendarPlus, ClipboardList, UserRound } from "lucide-react";
import { cn } from "@/lib/utils";
import { useI18n } from "@/components/i18n-provider";

/** แถบเมนูล่างของหน้าหลักฝั่งลูกค้า (จอง / การจองของฉัน / โปรไฟล์) — หน้าที่มีปุ่มลงมือแปะขอบล่างจะไม่แสดงแถบนี้ */
export function LiffTabs() {
  const { t } = useI18n();
  const pathname = usePathname();
  const current = pathname.startsWith("/liff/profile")
    ? "/liff/profile"
    : pathname.startsWith("/liff/orders") || pathname.startsWith("/liff/requests") || pathname.startsWith("/liff/pay")
      ? "/liff/orders"
      : "/liff/book";

  const tabs = [
    { href: "/liff/book", icon: CalendarPlus, label: t.liff.stepBookQueue },
    { href: "/liff/orders", icon: ClipboardList, label: t.liff.ordersPageTitle },
    { href: "/liff/profile", icon: UserRound, label: t.liff.profilePageTitle },
  ];

  return (
    <nav className="fixed inset-x-0 bottom-0 z-10 border-t bg-card pb-[env(safe-area-inset-bottom)]">
      <div className="mx-auto grid max-w-md grid-cols-3 sm:max-w-xl md:max-w-2xl lg:max-w-3xl">
        {tabs.map(({ href, icon: Icon, label }) => {
          const active = href === current;
          return (
            <Link
              key={href}
              href={href}
              aria-current={active ? "page" : undefined}
              className={cn(
                "flex flex-col items-center gap-0.5 px-1 py-2.5 text-[0.6875rem] transition-colors",
                active ? "font-semibold text-primary" : "text-muted-foreground hover:text-foreground"
              )}
            >
              <Icon className="h-5 w-5" />
              <span className="max-w-full truncate">{label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
