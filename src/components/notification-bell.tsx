"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Bell, BellRing, CalendarClock, Receipt } from "lucide-react";
import { getStaffAlerts, type StaffAlert } from "@/app/actions/notifications";
import { onStaffAlertsChanged } from "@/lib/staff-alerts-signal";
import { formatBaht, formatDateTime } from "@/lib/format";
import { cn } from "@/lib/utils";
import { useI18n } from "@/components/i18n-provider";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

/** ถามทุก 30 วินาที — ถี่พอให้พนักงานรู้เกือบทันที แต่ไม่ถี่จนยิงฐานข้อมูลทิ้งเปล่า */
const POLL_MS = 30_000;

export function NotificationBell() {
  const { t } = useI18n();
  const [count, setCount] = useState(0);
  const [items, setItems] = useState<StaffAlert[]>([]);
  const [canNotify, setCanNotify] = useState(false);

  // จำยอดครั้งก่อนไว้ เพื่อเด้งแจ้งเตือนเฉพาะตอน "มีของใหม่เพิ่มเข้ามา" ไม่ใช่ทุกรอบที่ถาม
  const lastCount = useRef<number | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await getStaffAlerts();
      setCount(res.count);
      setItems(res.items);
      if (typeof Notification !== "undefined") setCanNotify(Notification.permission === "granted");

      const previous = lastCount.current;
      lastCount.current = res.count;
      // ครั้งแรกที่โหลดยังไม่รู้ยอดเดิม ห้ามเด้ง ไม่งั้นจะเด้งทุกครั้งที่เปิดหน้าใหม่
      if (
        previous !== null &&
        res.count > previous &&
        typeof Notification !== "undefined" &&
        Notification.permission === "granted"
      ) {
        new Notification(t.notifications.newBookingTitle, {
          body: t.notifications.newBookingBody(res.count - previous),
          tag: "pending-approval",
        });
      }
    } catch {
      // ถามไม่สำเร็จ (เน็ตหลุด/เซสชันหมด) ปล่อยผ่าน รอบหน้าค่อยลองใหม่ ไม่ต้องรบกวนพนักงาน
    }
  }, [t]);

  useEffect(() => {
    const first = setTimeout(() => void load(), 0);
    const timer = setInterval(() => {
      // แท็บถูกซ่อนอยู่ก็ไม่ต้องถาม ประหยัดทั้งเครื่องลูกค้าและฐานข้อมูล
      if (document.visibilityState === "visible") void load();
    }, POLL_MS);
    const onVisible = () => document.visibilityState === "visible" && void load();
    document.addEventListener("visibilitychange", onVisible);
    // พนักงานเพิ่งยืนยันคิว/ยืนยันสลิปเสร็จ — ถามใหม่ทันที ไม่ต้องรอครบรอบ 30 วินาที
    const offChanged = onStaffAlertsChanged(() => void load());
    return () => {
      clearTimeout(first);
      clearInterval(timer);
      document.removeEventListener("visibilitychange", onVisible);
      offChanged();
    };
  }, [load]);

  async function askPermission() {
    if (typeof Notification === "undefined") return;
    const result = await Notification.requestPermission();
    setCanNotify(result === "granted");
  }

  const Icon = count > 0 ? BellRing : Bell;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={<Button variant="ghost" size="icon" className="relative" />}
        aria-label={t.notifications.title}
      >
        <Icon className={cn("h-5 w-5", count > 0 && "text-primary")} />
        {count > 0 && (
          <span className="absolute -top-0.5 -right-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-destructive px-1 text-[10px] font-semibold text-white tabular-nums">
            {count > 9 ? "9+" : count}
          </span>
        )}
      </DropdownMenuTrigger>

      <DropdownMenuContent align="end" className="w-80">
        <div className="border-b px-3 py-2 text-sm font-medium">{t.notifications.title}</div>

        {items.length === 0 ? (
          <p className="px-3 py-6 text-center text-sm text-muted-foreground">
            {t.notifications.empty}
          </p>
        ) : (
          items.map((it) => {
            const isSlip = it.kind === "SLIP";
            const RowIcon = isSlip ? Receipt : CalendarClock;
            return (
              <DropdownMenuItem
                key={it.key}
                render={<Link href={`/orders/${it.orderId}`} />}
                className="items-start gap-2 py-2"
              >
                <RowIcon
                  className={cn(
                    "mt-0.5 h-4 w-4 shrink-0",
                    isSlip ? "text-emerald-600" : "text-primary"
                  )}
                />
                <span className="flex min-w-0 flex-col gap-0.5">
                  <span className="text-xs font-medium text-muted-foreground">
                    {isSlip ? t.notifications.slipLabel : t.notifications.queueLabel}
                  </span>
                  <span className="truncate text-sm font-medium">
                    {it.customerName}
                    {it.petName && <span className="text-muted-foreground"> · {it.petName}</span>}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {it.code}
                    {it.amount !== null && ` · ${formatBaht(it.amount)}`} ·{" "}
                    {formatDateTime(new Date(it.at))}
                  </span>
                </span>
              </DropdownMenuItem>
            );
          })
        )}

        {!canNotify && typeof Notification !== "undefined" && (
          <button
            type="button"
            onClick={askPermission}
            className="w-full border-t px-3 py-2 text-left text-xs text-primary hover:bg-accent/50"
          >
            {t.notifications.enableDesktop}
          </button>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
