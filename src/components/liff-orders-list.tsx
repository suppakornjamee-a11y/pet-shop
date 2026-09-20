"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Loader2, XCircle } from "lucide-react";
import { liffListOrders } from "@/app/actions/liff";
import { formatBaht, formatDate, formatTime } from "@/lib/format";
import { cn } from "@/lib/utils";
import { useLiff, LiffGate, handleLiffAuthExpiry } from "@/components/liff-provider";
import { useI18n } from "@/components/i18n-provider";
import { LiffTabs } from "@/components/liff-tabs";
import type { OrderStatus } from "@/generated/prisma/enums";

type Kind = "BOARDING" | "BATH" | "OTHER";

type OrderRow = {
  id: string;
  code: string;
  createdAt: string;
  status: OrderStatus;
  petName: string | null;
  total: number;
  remainingAmount: number;
  hasSubmittedSlip: boolean;
  bookingRequestId: string | null;
  kind: Kind | null;
  appointmentAt: string | null;
  checkInAt: string | null;
  checkOutAt: string | null;
};

/** ระดับความเร่งด่วนของสถานะ — ใช้เลือกสถานะที่จะแสดงเมื่อคำขอเดียวมีหลายรายการ (เลขน้อย = ต้องดูก่อน) */
const STATUS_PRIORITY: OrderStatus[] = [
  "RESCHEDULE_REQUIRED",
  "PENDING_PAYMENT",
  "PENDING_APPROVAL",
  "DEPOSIT_PAID",
  "PAID",
  "IN_PROGRESS",
  "COMPLETED",
  "CANCELLED",
];

type Tone = "action" | "waiting" | "quiet";

function toneOf(o: OrderRow): Tone {
  if (o.status === "RESCHEDULE_REQUIRED") return "action";
  if (o.status === "PENDING_PAYMENT") return o.hasSubmittedSlip ? "waiting" : "action";
  if (o.status === "PENDING_APPROVAL") return "waiting";
  return "quiet";
}

const TONE_CLASS: Record<Tone, string> = {
  action: "text-primary",
  waiting: "text-amber-700",
  quiet: "text-muted-foreground",
};

/** คำขอจองเดียวอาจมีหลายออเดอร์ (หลายตัว/หลายบริการ) — รวมเป็นแถวเดียว ไปหน้าคำขอ · ออเดอร์เก่าที่ไม่มีคำขอไปหน้าชำระเงินเดิม */
function groupOrders(orders: OrderRow[]) {
  const groups = new Map<string, OrderRow[]>();
  for (const o of orders) {
    const key = o.bookingRequestId ?? o.id;
    groups.set(key, [...(groups.get(key) ?? []), o]);
  }
  return [...groups.values()];
}

function OrdersBody() {
  const { t } = useI18n();
  const { idToken } = useLiff();
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [orders, setOrders] = useState<OrderRow[]>([]);

  useEffect(() => {
    if (!idToken) return;
    let active = true;
    (async () => {
      const res = await liffListOrders(idToken);
      if (!active) return;
      if (!res.ok) {
        handleLiffAuthExpiry(res);
        // ยังไม่เคยลงทะเบียน/ผูก LINE ไว้เลย — ไม่มีออเดอร์ให้ดูอยู่แล้ว พาไปหน้าลงทะเบียนต่อเลย
        // แทนที่จะโชว์ error ค้างไว้เฉยๆ ให้ flow ต่อเนื่องเหมือนตอนเข้าทางหน้าแรก
        if ("notRegistered" in res && res.notRegistered) {
          router.replace("/liff/register");
          return;
        }
        setError(res.error);
        setLoading(false);
        return;
      }
      setOrders(res.orders as OrderRow[]);
      setLoading(false);
    })();
    return () => {
      active = false;
    };
  }, [idToken, router]);

  if (loading) {
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center gap-3 p-6 text-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <p className="text-sm text-muted-foreground">{t.liff.loadingTitle}</p>
      </div>
    );
  }
  if (error) {
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center gap-2 p-6 text-center">
        <XCircle className="h-10 w-10 text-destructive" />
        <p className="text-sm text-muted-foreground">{error}</p>
      </div>
    );
  }

  const rows = groupOrders(orders).map((group) => {
    const first = group[0];
    const lead = [...group].sort((a, b) => STATUS_PRIORITY.indexOf(a.status) - STATUS_PRIORITY.indexOf(b.status))[0];
    const pets = [...new Set(group.map((o) => o.petName).filter((n): n is string => !!n))];
    const kinds = [...new Set(group.map((o) => o.kind).filter((k): k is Kind => !!k))];
    // วันที่ที่จะแสดง: คิวที่ใกล้ที่สุดของคำขอนี้ (ห้องพักแสดงเป็นช่วงเช็คอิน–เช็คเอาท์)
    const dated = group
      .map((o) => ({ o, at: o.appointmentAt ?? o.checkInAt }))
      .filter((x): x is { o: OrderRow; at: string } => !!x.at)
      .sort((a, b) => a.at.localeCompare(b.at))[0];
    let when = formatDate(first.createdAt);
    if (dated?.o.appointmentAt) {
      when = `${formatDate(dated.at)} · ${formatTime(dated.at)} ${t.liff.timeUnitSuffix}`;
    } else if (dated?.o.checkInAt && dated.o.checkOutAt) {
      when = `${formatDate(dated.o.checkInAt)} – ${formatDate(dated.o.checkOutAt)}`;
    }
    const tone = toneOf(lead);
    return {
      key: first.bookingRequestId ?? first.id,
      href: first.bookingRequestId ? `/liff/requests/${first.bookingRequestId}` : `/liff/pay/${first.id}`,
      title: [pets.join(", "), kinds.map((k) => t.liffBook.kind[k]).join(", ")].filter(Boolean).join(" · ") || first.code,
      when,
      total: group.reduce((sum, o) => sum + o.total, 0),
      tone,
      status: lead.hasSubmittedSlip && lead.status === "PENDING_PAYMENT" ? t.orders.slipPendingReviewBadge : t.labels.orderStatus[lead.status],
    };
  });

  return (
    <div className="space-y-4 pb-20">
      <h1 className="text-lg font-semibold">{t.liff.ordersPageTitle}</h1>

      {rows.length === 0 ? (
        <div className="py-16 text-center">
          <p className="font-medium">{t.liff.ordersEmptyTitle}</p>
          <p className="mt-1 text-sm text-muted-foreground">{t.liff.ordersEmptyHint}</p>
        </div>
      ) : (
        <div className="divide-y overflow-hidden rounded-2xl border bg-card">
          {rows.map((r) => (
            <Link
              key={r.key}
              href={r.href}
              className="flex items-center gap-3 px-4 py-3.5 transition-colors hover:bg-muted/50 active:bg-muted"
            >
              <div className="min-w-0 flex-1">
                <div className="truncate font-medium">{r.title}</div>
                <div className="mt-0.5 truncate text-xs text-muted-foreground">{r.when}</div>
              </div>
              <div className="shrink-0 text-right">
                <div className="font-medium tabular-nums">{formatBaht(r.total)}</div>
                <div className={cn("mt-0.5 flex items-center justify-end gap-1.5 text-xs", TONE_CLASS[r.tone])}>
                  <span className="h-1.5 w-1.5 rounded-full bg-current" />
                  {r.status}
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}
      <LiffTabs />
    </div>
  );
}

export function LiffOrdersList() {
  return (
    <LiffGate>
      <OrdersBody />
    </LiffGate>
  );
}
