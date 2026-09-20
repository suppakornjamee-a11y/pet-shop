"use client";

import { useCallback, useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Bath, Check, Home, Loader2, Scissors, XCircle } from "lucide-react";
import { liffGetBookingRequest, liffRescheduleBookingRequest } from "@/app/actions/liff";
import { formatBaht, formatDateLong, formatTime } from "@/lib/format";
import { toThaiDateStr } from "@/lib/slots";
import { cn } from "@/lib/utils";
import { useLiff, LiffGate, handleLiffAuthExpiry } from "@/components/liff-provider";
import { useI18n } from "@/components/i18n-provider";
import { LiffPaymentBody } from "@/components/liff-payment-view";
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

/** การ์ดสรุปรายการ — หน้าตาเดียวกับหน้าจองแบบเดิม */
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
    <div className="rounded-2xl border bg-card p-4">
      <div className="flex items-start gap-3">
        <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-accent/40">
          <Icon className="h-5 w-5 text-primary" />
        </span>
        <div className="min-w-0 flex-1">
          <div className="font-semibold">{[t.liffBook.kind[kind], ...names].join(" · ")}</div>
          {order.pet && <div className="text-xs text-muted-foreground">{order.pet.name}</div>}
          {order.groomingStyleNote && (
            <div className="text-xs text-muted-foreground">
              {t.liffBook.styleTitle}: {order.groomingStyleNote}
            </div>
          )}
        </div>
        <div className="font-semibold text-primary">{formatBaht(order.total)}</div>
      </div>

      <div className="my-4 border-t border-dashed" />

      <dl className="space-y-2.5 text-sm">
        {kind === "BOARDING" && order.checkInAt && order.checkOutAt ? (
          <>
            <div className="flex items-center justify-between gap-3">
              <dt className="text-muted-foreground">{t.orders.form.checkInLabel}</dt>
              <dd className="text-right font-medium">
                {formatDateLong(order.checkInAt)} {timeOf(order.checkInAt)} {t.liff.timeUnitSuffix}
              </dd>
            </div>
            <div className="flex items-center justify-between gap-3">
              <dt className="text-muted-foreground">{t.liff.summaryCheckOutLabel}</dt>
              <dd className="text-right font-medium">
                {formatDateLong(order.checkOutAt)} {timeOf(order.checkOutAt)} {t.liff.timeUnitSuffix}
              </dd>
            </div>
          </>
        ) : order.appointmentAt ? (
          <>
            <div className="flex items-center justify-between gap-3">
              <dt className="text-muted-foreground">{t.liff.summaryDateLabel}</dt>
              <dd className="text-right font-medium">{formatDateLong(order.appointmentAt)}</dd>
            </div>
            <div className="flex items-center justify-between gap-3">
              <dt className="text-muted-foreground">{t.liff.summaryTimeLabel}</dt>
              <dd className="text-right font-medium">
                {timeOf(order.appointmentAt)} {t.liff.timeUnitSuffix}
              </dd>
            </div>
          </>
        ) : null}
        {showPaid && (
          <>
            <div className="flex items-center justify-between gap-3 border-t border-dashed pt-2.5">
              <dt className="text-muted-foreground">{t.liffBook.estimate}</dt>
              <dd className="text-right font-medium">{formatBaht(order.total)}</dd>
            </div>
            {order.paid >= order.total ? (
              <div className="flex items-center justify-between gap-3">
                <dt className="text-muted-foreground">{t.orders.payment.fullyPaid}</dt>
                <dd className="text-right font-medium">{formatBaht(order.paid)}</dd>
              </div>
            ) : (
              <>
                <div className="flex items-center justify-between gap-3">
                  <dt className="text-muted-foreground">{t.liffBook.depositPaid}</dt>
                  <dd className="text-right font-medium">{formatBaht(order.paid)}</dd>
                </div>
                <div className="flex items-center justify-between gap-3">
                  <dt className="text-muted-foreground">{t.liffBook.remaining}</dt>
                  <dd className="text-right font-medium">{formatBaht(order.total - order.paid)}</dd>
                </div>
              </>
            )}
          </>
        )}
      </dl>
    </div>
  );
}

function StatusHero({ tone, title, children }: { tone: "ok" | "bad"; title: string; children?: React.ReactNode }) {
  return (
    <div className="flex flex-col items-center gap-3 pt-2 text-center">
      <div className={cn("flex h-16 w-16 items-center justify-center rounded-full", tone === "bad" ? "bg-destructive/15" : "bg-accent/40")}>
        <span className={cn("flex h-11 w-11 items-center justify-center rounded-full", tone === "bad" ? "bg-destructive" : "bg-primary")}>
          {tone === "bad" ? (
            <XCircle className="h-5 w-5 text-primary-foreground" />
          ) : (
            <Check className="h-5 w-5 text-primary-foreground" strokeWidth={3} />
          )}
        </span>
      </div>
      <h1 className="text-xl font-bold tracking-tight">{title}</h1>
      {children}
    </div>
  );
}

function RequestBody({ requestId, initialOrderId }: { requestId: string; initialOrderId?: string }) {
  const { t } = useI18n();
  const router = useRouter();
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
    <div className={cn("space-y-5 py-2", selected.status === "RESCHEDULE_REQUIRED" && "pb-28")}>
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
              <p className="rounded-xl bg-destructive/10 px-3 py-2 text-sm font-medium text-destructive">
                {t.liff.slipRejectedReason(selected.queueRejectReason)}
              </p>
            )}
          </StatusHero>
          <SummaryCard order={selected} t={t} />
          {draft &&
            (draft.kind === "BOARDING" ? (
              <div className="grid gap-3 rounded-2xl border bg-card p-4 lg:grid-cols-2">
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
              {t.liffBook.resubmit}
            </Button>
          </div>
        </>
      ) : selected.status === "PENDING_APPROVAL" ? (
        <>
          <StatusHero tone="ok" title={t.liff.checkingQueueTitle} />
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
            <span className="rounded-full bg-accent/40 px-3 py-1 text-xs font-medium text-primary">
              {t.labels.bookingRequestStatus.CONFIRMED}
            </span>
          </StatusHero>
          <SummaryCard order={selected} t={t} showPaid />
          {isBath && selected.paid < selected.total && (
            <p className="text-center text-xs text-muted-foreground">{t.liffBook.depositNote}</p>
          )}
        </>
      )}

      {selected.status !== "RESCHEDULE_REQUIRED" && (
        <Button variant="outline" className="h-12 w-full rounded-2xl" onClick={() => router.push("/liff/book")}>
          {t.liffBook.newBooking}
        </Button>
      )}
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
