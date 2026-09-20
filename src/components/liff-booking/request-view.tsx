"use client";

import { useCallback, useEffect, useState, useTransition } from "react";
import { toast } from "sonner";
import { Check, Hourglass, Loader2, X } from "lucide-react";
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

/** แถวข้อมูลในการ์ดสรุป — ชื่อหัวข้อจางๆ ค่าชิดขวา */
function InfoRow({ label, children, strong = false }: { label: string; children: React.ReactNode; strong?: boolean }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className={cn("text-right font-medium tabular-nums", strong && "font-semibold text-primary")}>{children}</dd>
    </div>
  );
}

/** การ์ดสรุปรายการ — ส่วนบนบอกบริการ/ราคา ส่วนล่างบอกวันเวลา */
function SummaryCard({ order, t, showPaid = false }: { order: RequestOrder; t: T; showPaid?: boolean }) {
  const kind = orderKind(order);
  const names = [
    ...(order.room ? [`${order.room.category.name} · ${order.room.name}`] : []),
    ...order.items
      .filter((it) => it.itemType === "SERVICE")
      .sort((a, b) => b.subtotal - a.subtotal)
      .map((it) => it.name),
  ];
  return (
    <div className="rounded-2xl border bg-card p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="font-semibold">{t.liffBook.kind[kind]}</div>
          {order.pet && (
            <div className="mt-0.5 flex items-center gap-1 text-sm text-muted-foreground">
              <SpeciesIcon species={order.pet.species} className="h-4 w-4" /> {order.pet.name}
            </div>
          )}
        </div>
        <div className="font-semibold tabular-nums">{formatBaht(order.total)}</div>
      </div>
      {names.length > 0 && <p className="mt-2 text-sm text-muted-foreground">{names.join(" · ")}</p>}
      {order.groomingStyleNote && (
        <p className="mt-1 text-sm text-muted-foreground">
          {t.liffBook.styleTitle}: {order.groomingStyleNote}
        </p>
      )}

      <dl className="mt-3 space-y-2 border-t pt-3 text-sm">
        {kind === "BOARDING" && order.checkInAt && order.checkOutAt ? (
          <>
            <InfoRow label={t.orders.form.checkInLabel}>
              {formatDateLong(order.checkInAt)} {timeOf(order.checkInAt)} {t.liff.timeUnitSuffix}
            </InfoRow>
            <InfoRow label={t.liff.summaryCheckOutLabel}>
              {formatDateLong(order.checkOutAt)} {timeOf(order.checkOutAt)} {t.liff.timeUnitSuffix}
            </InfoRow>
          </>
        ) : order.appointmentAt ? (
          <>
            <InfoRow label={t.liff.summaryDateLabel}>{formatDateLong(order.appointmentAt)}</InfoRow>
            <InfoRow label={t.liff.summaryTimeLabel}>
              {timeOf(order.appointmentAt)} {t.liff.timeUnitSuffix}
            </InfoRow>
          </>
        ) : null}
      </dl>

      {showPaid && (
        <dl className="mt-3 space-y-2 border-t border-dashed pt-3 text-sm">
          <InfoRow label={t.liffBook.estimate}>{formatBaht(order.total)}</InfoRow>
          {order.paid >= order.total ? (
            <InfoRow label={t.orders.payment.fullyPaid}>{formatBaht(order.paid)}</InfoRow>
          ) : (
            <>
              <InfoRow label={t.liffBook.depositPaid}>{formatBaht(order.paid)}</InfoRow>
              <InfoRow label={t.liffBook.remaining} strong>
                {formatBaht(order.total - order.paid)}
              </InfoRow>
            </>
          )}
        </dl>
      )}
    </div>
  );
}

/** หัวสถานะ — wait = รอแอดมินตรวจสอบ · ok = สำเร็จ · bad = มีปัญหา (ไอคอนวงกลมเล็ก + ชื่อสถานะ + บรรทัดรอง) */
function StatusHero({ tone, title, children }: { tone: "ok" | "wait" | "bad"; title: string; children?: React.ReactNode }) {
  const bad = tone === "bad";
  const Icon = bad ? X : tone === "wait" ? Hourglass : Check;
  return (
    <div className="flex items-center gap-3">
      <span
        className={cn(
          "flex h-11 w-11 shrink-0 items-center justify-center rounded-full",
          bad ? "bg-destructive/10 text-destructive" : "bg-primary/10 text-primary"
        )}
      >
        <Icon className="h-5 w-5" />
      </span>
      <div className="min-w-0">
        <h1 className="text-lg font-semibold leading-tight">{title}</h1>
        {children}
      </div>
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
              <p className="text-sm text-destructive">{t.liff.slipRejectedReason(selected.queueRejectReason)}</p>
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
              {t.liffBook.resubmit}
            </Button>
          </div>
        </>
      ) : selected.status === "PENDING_APPROVAL" ? (
        <>
          <StatusHero tone="wait" title={t.liff.checkingQueueTitle}>
            <p className="text-sm text-muted-foreground">{t.labels.bookingRequestStatus.PENDING_APPROVAL}</p>
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
            <p className="text-sm text-muted-foreground">{t.labels.bookingRequestStatus.CONFIRMED}</p>
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
