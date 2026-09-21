"use client";

import { useCallback, useEffect, useState, useTransition } from "react";
import { toast } from "sonner";
import { Bath, CalendarDays, Check, Clock, Home, Hourglass, Loader2, LogIn, LogOut, Scissors, X } from "lucide-react";
import { liffGetBookingRequest, liffRescheduleBookingRequest } from "@/app/actions/liff";
import { formatBaht, formatDateLong, formatTime } from "@/lib/format";
import { toThaiDateStr } from "@/lib/slots";
import { cn } from "@/lib/utils";
import { useLiff, LiffGate, handleLiffAuthExpiry } from "@/components/liff-provider";
import { useI18n } from "@/components/i18n-provider";
import { LiffPaymentBody } from "@/components/liff-payment-view";
import { LiffTabs } from "@/components/liff-tabs";
import { SpeciesIcon } from "@/components/species-icon";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { SlotPicker } from "./item-detail";
import { newItemDraft, type ItemDraft } from "./cart";
import { Stepper, todayStr, type Kind, type Step, type T } from "./shared";

type RequestData = Extract<Awaited<ReturnType<typeof liffGetBookingRequest>>, { ok: true }>;
type RequestOrder = RequestData["orders"][number];

const POLL_MS = 8000;
const KIND_ICONS: Record<Kind, typeof Home> = { BOARDING: Home, BATH: Bath, OTHER: Scissors };

/** ขั้นของแถบด้านบน ตามสถานะของรายการที่กำลังดู — แต่ละรายการเดินหน้าแยกกัน (แอดมินอนุมัติทีละรายการ) */
function stepOf(o: RequestOrder): Step {
  if (o.status === "PENDING_PAYMENT") return 3;
  if (o.status === "PENDING_APPROVAL" || o.status === "RESCHEDULE_REQUIRED" || o.status === "CANCELLED") return 2;
  return 4;
}

/** รายการที่ลูกค้าต้องลงมือก่อน (เลือกวันใหม่ / ชำระเงินที่ยังไม่ส่งสลิป) — ใช้เลือกแท็บเริ่มต้น */
function needsAction(o: RequestOrder): boolean {
  return o.status === "RESCHEDULE_REQUIRED" || (o.status === "PENDING_PAYMENT" && o.paymentStatus !== "SUBMITTED");
}

function orderKind(o: RequestOrder): Kind {
  if (o.room) return "BOARDING";
  return o.queueType === "OTHER" ? "OTHER" : "BATH";
}

function timeOf(iso: string) {
  return formatTime(new Date(iso));
}

function draftFor(o: RequestOrder): ItemDraft {
  const kind = orderKind(o);
  const d = newItemDraft(kind, o.pet?.id ?? "");
  if (kind === "BOARDING" && o.checkInAt && o.checkOutAt) {
    d.date = toThaiDateStr(new Date(o.checkInAt));
    d.checkInTime = timeOf(o.checkInAt);
    d.checkOutDate = toThaiDateStr(new Date(o.checkOutAt));
    d.checkOutTime = timeOf(o.checkOutAt);
  } else if (o.appointmentAt) {
    const day = toThaiDateStr(new Date(o.appointmentAt));
    d.date = day < todayStr() ? todayStr() : day;
  }
  return d;
}

const gradientFill = (color: "primary" | "destructive") =>
  ({
    backgroundColor: `var(--${color})`,
    backgroundImage: `linear-gradient(135deg, var(--${color}), color-mix(in oklab, var(--${color}) 55%, white))`,
  }) as const;

const softGradient = (color: "primary" | "destructive") =>
  ({
    backgroundImage:
      color === "primary"
        ? "linear-gradient(135deg, color-mix(in oklab, var(--accent) 45%, white), color-mix(in oklab, var(--primary) 6%, white))"
        : "linear-gradient(135deg, color-mix(in oklab, var(--destructive) 12%, white), color-mix(in oklab, var(--destructive) 4%, white))",
  }) as const;

/** แถวข้อมูลในการ์ดสรุป — ไอคอนในช่องสี่เหลี่ยมมนหน้าชื่อหัวข้อ ค่าชิดขวา */
function InfoRow({ icon: Icon, label, children }: { icon: typeof Clock; label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <dt className="flex items-center gap-2.5 text-muted-foreground">
        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-accent/40 text-primary">
          <Icon className="h-4 w-4" />
        </span>
        {label}
      </dt>
      <dd className="text-right font-semibold">{children}</dd>
    </div>
  );
}

/** การ์ดสรุปรายการแบบตั๋ว — ส่วนบนบอกบริการ/ราคา ส่วนล่างบอกวันเวลา คั่นด้วยเส้นประและรอยบาก */
function SummaryCard({ order, t, showPaid = false }: { order: RequestOrder; t: T; showPaid?: boolean }) {
  const kind = orderKind(order);
  const Icon = KIND_ICONS[kind];
  const names = [
    ...(order.room ? [`${order.room.category.name} · ${order.room.name}`] : []),
    ...order.items
      .filter((it) => it.itemType === "SERVICE")
      .sort((a, b) => b.subtotal - a.subtotal)
      .map((it) => it.name),
  ];
  return (
    <div className="overflow-hidden rounded-3xl border bg-card shadow-[0_2px_10px_rgba(0,0,0,0.04)]">
      <div className="flex items-start gap-3 p-4">
        <span
          className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl text-primary-foreground shadow-sm"
          style={gradientFill("primary")}
        >
          <Icon className="h-6 w-6" />
        </span>
        <div className="min-w-0 flex-1 space-y-2">
          <div>
            <div className="font-semibold leading-tight">{t.liffBook.kind[kind]}</div>
            {order.pet && (
              <div className="mt-0.5 flex items-center gap-1 text-sm text-muted-foreground">
                <SpeciesIcon species={order.pet.species} className="h-4 w-4" /> {order.pet.name}
              </div>
            )}
          </div>
          {names.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {names.map((n) => (
                <span key={n} className="rounded-full bg-accent/30 px-2.5 py-0.5 text-xs font-medium text-accent-foreground">
                  {n}
                </span>
              ))}
            </div>
          )}
          {order.groomingStyleNote && (
            <div className="text-xs text-muted-foreground">
              {t.liffBook.styleTitle}: {order.groomingStyleNote}
            </div>
          )}
        </div>
        <div className="text-lg font-bold tabular-nums text-primary">{formatBaht(order.total)}</div>
      </div>

      <div className="relative">
        <div className="mx-4 border-t border-dashed" />
        <span className="absolute -left-2.5 top-1/2 h-5 w-5 -translate-y-1/2 rounded-full border bg-background" />
        <span className="absolute -right-2.5 top-1/2 h-5 w-5 -translate-y-1/2 rounded-full border bg-background" />
      </div>

      <dl className="space-y-3 p-4 text-sm">
        {kind === "BOARDING" && order.checkInAt && order.checkOutAt ? (
          <>
            <InfoRow icon={LogIn} label={t.orders.form.checkInLabel}>
              {formatDateLong(order.checkInAt)} {timeOf(order.checkInAt)} {t.liff.timeUnitSuffix}
            </InfoRow>
            <InfoRow icon={LogOut} label={t.liff.summaryCheckOutLabel}>
              {formatDateLong(order.checkOutAt)} {timeOf(order.checkOutAt)} {t.liff.timeUnitSuffix}
            </InfoRow>
          </>
        ) : order.appointmentAt ? (
          <>
            <InfoRow icon={CalendarDays} label={t.liff.summaryDateLabel}>
              {formatDateLong(order.appointmentAt)}
            </InfoRow>
            <InfoRow icon={Clock} label={t.liff.summaryTimeLabel}>
              {timeOf(order.appointmentAt)} {t.liff.timeUnitSuffix}
            </InfoRow>
          </>
        ) : null}
        {showPaid && (
          <div className="space-y-2 rounded-2xl bg-accent/20 p-3">
            <div className="flex items-center justify-between gap-3">
              <dt className="text-muted-foreground">{t.liffBook.estimate}</dt>
              <dd className="text-right font-semibold tabular-nums">{formatBaht(order.total)}</dd>
            </div>
            {order.paid >= order.total ? (
              <div className="flex items-center justify-between gap-3">
                <dt className="text-muted-foreground">{t.orders.payment.fullyPaid}</dt>
                <dd className="text-right font-semibold tabular-nums">{formatBaht(order.paid)}</dd>
              </div>
            ) : (
              <>
                <div className="flex items-center justify-between gap-3">
                  <dt className="text-muted-foreground">{t.liffBook.depositPaid}</dt>
                  <dd className="text-right font-semibold tabular-nums">{formatBaht(order.paid)}</dd>
                </div>
                <div className="flex items-center justify-between gap-3 border-t border-dashed border-primary/30 pt-2">
                  <dt className="font-medium">{t.liffBook.remaining}</dt>
                  <dd className="text-right text-base font-bold tabular-nums text-primary">{formatBaht(order.total - order.paid)}</dd>
                </div>
              </>
            )}
          </div>
        )}
      </dl>
    </div>
  );
}

/** ป้ายสถานะใต้หัวเรื่อง */
function StatusPill({ children }: { children: React.ReactNode }) {
  return (
    <span className="inline-flex items-center gap-2 rounded-full bg-card px-3.5 py-1.5 text-sm font-medium text-primary shadow-sm ring-1 ring-primary/15">
      <span className="h-2 w-2 rounded-full bg-primary" />
      {children}
    </span>
  );
}

/** หัวหน้าสถานะ — wait = รอแอดมินตรวจสอบ (นาฬิกาทราย) · ok = สำเร็จ · bad = มีปัญหา — ไม่มีอะไรกะพริบ/เคลื่อนไหว */
function StatusHero({ tone, title, children }: { tone: "ok" | "wait" | "bad"; title: string; children?: React.ReactNode }) {
  const bad = tone === "bad";
  const Icon = bad ? X : tone === "wait" ? Hourglass : Check;
  return (
    <div
      className={cn(
        "flex flex-col items-center gap-3.5 rounded-3xl border px-4 py-7 text-center",
        bad ? "border-destructive/20" : "border-primary/20"
      )}
      style={softGradient(bad ? "destructive" : "primary")}
    >
      <div className="relative flex h-20 w-20 items-center justify-center">
        <span className={cn("absolute inset-0 rounded-full", bad ? "bg-destructive/10" : "bg-primary/10")} />
        <span
          className="relative flex h-14 w-14 items-center justify-center rounded-full text-primary-foreground shadow-md ring-4 ring-white/80"
          style={gradientFill(bad ? "destructive" : "primary")}
        >
          <Icon className="h-7 w-7" strokeWidth={tone === "wait" ? 2.25 : 3} />
        </span>
      </div>
      <h1 className="text-xl font-bold tracking-tight">{title}</h1>
      {children}
    </div>
  );
}

function RequestBody({ requestId, initialOrderId }: { requestId: string; initialOrderId?: string }) {
  const { t } = useI18n();
  const { idToken } = useLiff();
  const [data, setData] = useState<RequestData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(initialOrderId ?? null);
  const [drafts, setDrafts] = useState<Record<string, ItemDraft>>({});
  const [isPending, startTransition] = useTransition();

  const load = useCallback(async () => {
    if (!idToken) return;
    const res = await liffGetBookingRequest(idToken, requestId);
    if (!res.ok) {
      handleLiffAuthExpiry(res);
      setError(res.error);
      return;
    }
    setData(res);
  }, [idToken, requestId]);

  useEffect(() => {
    const first = setTimeout(() => void load(), 0);
    const id = setInterval(() => {
      if (document.visibilityState === "visible") void load();
    }, POLL_MS);
    return () => {
      clearTimeout(first);
      clearInterval(id);
    };
  }, [load]);

  const selected =
    data?.orders.find((o) => o.id === selectedId) ??
    data?.orders.find(needsAction) ??
    data?.orders.find((o) => o.status !== "CANCELLED") ??
    data?.orders[0] ??
    null;

  // เตรียมวันเวลาเดิมไว้ให้แก้ เมื่อแอดมินแจ้งคิวไม่ว่าง (ครั้งเดียวต่อรายการ)
  if (selected?.status === "RESCHEDULE_REQUIRED" && !drafts[selected.id]) {
    setDrafts({ ...drafts, [selected.id]: draftFor(selected) });
  }

  function resubmit(o: RequestOrder) {
    const d = drafts[o.id];
    if (!idToken || !d) return;
    startTransition(async () => {
      const res = await liffRescheduleBookingRequest(idToken, requestId, {
        items: [
          d.kind === "BOARDING"
            ? { orderId: o.id, checkInDate: d.date, checkInTime: d.checkInTime, checkOutDate: d.checkOutDate, checkOutTime: d.checkOutTime }
            : { orderId: o.id, appointmentDate: d.date, appointmentTime: d.time },
        ],
      });
      if (!res.ok) {
        handleLiffAuthExpiry(res);
        toast.error(res.error);
        return;
      }
      const next = { ...drafts };
      delete next[o.id];
      setDrafts(next);
      await load();
    });
  }

  if (error) return <p className="py-16 text-center text-sm text-muted-foreground">{error}</p>;
  if (!data || !selected) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  const draft = drafts[selected.id];
  const isBath = orderKind(selected) === "BATH";
  const setDraft = (patch: Partial<ItemDraft>) =>
    setDrafts((cur) => ({ ...cur, [selected.id]: { ...cur[selected.id], ...patch } }));
  const canResubmit = !!draft && (draft.kind === "BOARDING" ? !!draft.date && !!draft.checkOutDate : !!draft.time);

  return (
    <div className={cn("space-y-5 py-2", selected.status === "RESCHEDULE_REQUIRED" ? "pb-28" : "pb-20")}>
      <Stepper step={stepOf(selected)} t={t} />

      {data.orders.length > 1 && (
        <div className="flex flex-wrap gap-2">
          {data.orders.map((o) => {
            const active = o.id === selected.id;
            return (
              <button
                key={o.id}
                type="button"
                onClick={() => setSelectedId(o.id)}
                className={cn(
                  "flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-sm transition-colors",
                  active ? "border-primary bg-primary/10 font-medium text-primary" : "bg-card hover:bg-muted",
                  o.status === "CANCELLED" && "opacity-50"
                )}
              >
                {o.pet && <SpeciesIcon species={o.pet.species} className="h-4 w-4" />}
                {o.pet?.name} · {t.liffBook.kind[orderKind(o)]}
                {needsAction(o) && <span className="h-2 w-2 rounded-full bg-destructive" />}
              </button>
            );
          })}
        </div>
      )}

      {selected.status === "PENDING_PAYMENT" ? (
        <>
          {/* หน้าชำระเงินแบบเดิมของออเดอร์ — ถามสถานะเองทุก 8 วินาที อัปเดตต่อเองทั้งตอนส่งสลิปและตอนร้านยืนยันเงิน */}
          <LiffPaymentBody key={selected.id} orderId={selected.id} />
          {isBath && <p className="text-center text-xs text-muted-foreground">{t.liffBook.depositNote}</p>}
        </>
      ) : selected.status === "RESCHEDULE_REQUIRED" ? (
        <>
          <StatusHero tone="bad" title={t.liff.queueRejectedTitle}>
            {selected.queueRejectReason && (
              <p className="rounded-xl bg-card px-3 py-2 text-sm font-medium text-destructive ring-1 ring-destructive/20">
                {t.liff.slipRejectedReason(selected.queueRejectReason)}
              </p>
            )}
          </StatusHero>
          <SummaryCard order={selected} t={t} />
          {draft &&
            (draft.kind === "BOARDING" ? (
              <div className="grid grid-cols-1 gap-3 rounded-2xl border bg-card p-4 lg:grid-cols-2">
                <div className="space-y-1.5">
                  <Label className="text-xs text-muted-foreground">{t.orders.form.checkInLabel}</Label>
                  <div className="grid grid-cols-[1fr_auto] gap-2">
                    <Input type="date" className="min-w-0" min={todayStr()} value={draft.date} onChange={(e) => setDraft({ date: e.target.value })} />
                    <Input type="time" className="w-28" value={draft.checkInTime} onChange={(e) => setDraft({ checkInTime: e.target.value })} />
                  </div>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs text-muted-foreground">{t.orders.form.checkOutLabel}</Label>
                  <div className="grid grid-cols-[1fr_auto] gap-2">
                    <Input
                      type="date"
                      className="min-w-0"
                      min={draft.date}
                      value={draft.checkOutDate}
                      onChange={(e) => setDraft({ checkOutDate: e.target.value })}
                    />
                    <Input type="time" className="w-28" value={draft.checkOutTime} onChange={(e) => setDraft({ checkOutTime: e.target.value })} />
                  </div>
                </div>
              </div>
            ) : (
              <SlotPicker key={selected.id} draft={draft} set={setDraft} t={t} />
            ))}
          <div className="fixed inset-x-3 bottom-3 z-10 mx-auto max-w-md sm:max-w-xl md:max-w-2xl lg:max-w-3xl">
            <Button className="h-14 w-full rounded-2xl text-base" disabled={!canResubmit || isPending} onClick={() => resubmit(selected)}>
              {isPending && <Loader2 className="animate-spin" />}
              {t.common.confirm}
            </Button>
          </div>
        </>
      ) : selected.status === "PENDING_APPROVAL" ? (
        <>
          <StatusHero tone="wait" title={t.liff.checkingQueueTitle}>
            <StatusPill>{t.labels.bookingRequestStatus.PENDING_APPROVAL}</StatusPill>
          </StatusHero>
          <SummaryCard order={selected} t={t} />
        </>
      ) : selected.status === "CANCELLED" ? (
        <>
          <StatusHero tone="bad" title={t.labels.orderStatus.CANCELLED} />
          <SummaryCard order={selected} t={t} />
        </>
      ) : (
        <>
          <StatusHero tone="ok" title={t.liff.inProgressTitle}>
            <StatusPill>{t.labels.bookingRequestStatus.CONFIRMED}</StatusPill>
          </StatusHero>
          <SummaryCard order={selected} t={t} showPaid />
          {isBath && selected.paid < selected.total && (
            <p className="text-center text-xs text-muted-foreground">{t.liffBook.depositNote}</p>
          )}
        </>
      )}

      {selected.status !== "RESCHEDULE_REQUIRED" && <LiffTabs />}
    </div>
  );
}

export function LiffRequestView({ requestId, initialOrderId }: { requestId: string; initialOrderId?: string }) {
  return (
    <LiffGate>
      <RequestBody requestId={requestId} initialOrderId={initialOrderId} />
    </LiffGate>
  );
}
