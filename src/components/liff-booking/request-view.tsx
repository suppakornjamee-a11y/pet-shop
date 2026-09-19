"use client";

import { useCallback, useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Bath, Home, Loader2, Scissors } from "lucide-react";
import { liffGetBookingRequest, liffRescheduleBookingRequest } from "@/app/actions/liff";
import { formatBaht, formatDateLong, formatTime } from "@/lib/format";
import { toThaiDateStr } from "@/lib/slots";
import { cn } from "@/lib/utils";
import { useLiff, LiffGate, handleLiffAuthExpiry } from "@/components/liff-provider";
import { useI18n } from "@/components/i18n-provider";
import { SpeciesIcon } from "@/components/species-icon";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { SlotPicker } from "./item-detail";
import { newItemDraft, type ItemDraft } from "./cart";
import { Stepper, todayStr, type Kind, type Step } from "./shared";

type RequestData = Extract<Awaited<ReturnType<typeof liffGetBookingRequest>>, { ok: true }>;
type RequestOrder = RequestData["orders"][number];

const POLL_MS = 8000;
const KIND_ICONS: Record<Kind, typeof Home> = { BOARDING: Home, BATH: Bath, OTHER: Scissors };

const STEP_BY_STATUS: Record<RequestData["status"], Step> = {
  PENDING_APPROVAL: 2,
  NEEDS_RESCHEDULE: 2,
  PENDING_DEPOSIT: 3,
  DEPOSIT_SUBMITTED: 3,
  CONFIRMED: 4,
  CANCELLED: 2,
};

function orderKind(o: RequestOrder): Kind {
  if (o.room) return "BOARDING";
  return o.queueType === "OTHER" ? "OTHER" : "BATH";
}

function timeOf(iso: string) {
  return formatTime(new Date(iso));
}

function RequestBody({ requestId }: { requestId: string }) {
  const { t } = useI18n();
  const router = useRouter();
  const { idToken } = useLiff();
  const [data, setData] = useState<RequestData | null>(null);
  const [error, setError] = useState<string | null>(null);
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

  // เตรียมวันเวลาเดิมของแต่ละรายการไว้ให้แก้ เมื่อแอดมินแจ้งคิวไม่ว่าง (ทำครั้งเดียวต่อรายการ)
  const rescheduleOrders = data?.status === "NEEDS_RESCHEDULE" ? data.orders.filter((o) => o.status === "RESCHEDULE_REQUIRED") : [];
  const missing = rescheduleOrders.filter((o) => !drafts[o.id]);
  if (missing.length > 0) {
    const next = { ...drafts };
    for (const o of missing) {
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
      next[o.id] = d;
    }
    setDrafts(next);
  }

  function resubmit() {
    if (!idToken) return;
    startTransition(async () => {
      const res = await liffRescheduleBookingRequest(idToken, requestId, {
        items: rescheduleOrders.map((o) => {
          const d = drafts[o.id];
          return d.kind === "BOARDING"
            ? { orderId: o.id, checkInDate: d.date, checkInTime: d.checkInTime, checkOutDate: d.checkOutDate, checkOutTime: d.checkOutTime }
            : { orderId: o.id, appointmentDate: d.date, appointmentTime: d.time };
        }),
      });
      if (!res.ok) {
        handleLiffAuthExpiry(res);
        const o = "orderId" in res ? rescheduleOrders.find((x) => x.id === res.orderId) : undefined;
        toast.error(o?.pet ? `${o.pet.name}: ${res.error}` : res.error);
        return;
      }
      setDrafts({});
      await load();
    });
  }

  if (error) return <p className="py-16 text-center text-sm text-muted-foreground">{error}</p>;
  if (!data) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  const active = data.orders.filter((o) => o.status !== "CANCELLED");
  const totalEstimate = active.reduce((s, o) => s + o.total, 0);
  const totalDue = active.reduce((s, o) => s + o.dueNow, 0);
  const hasBath = active.some((o) => orderKind(o) === "BATH");
  const canResubmit =
    rescheduleOrders.length > 0 &&
    rescheduleOrders.every((o) => {
      const d = drafts[o.id];
      return d && (d.kind === "BOARDING" ? !!d.date && !!d.checkOutDate : !!d.time);
    });

  return (
    <div className={cn("space-y-4", data.status === "NEEDS_RESCHEDULE" && "pb-28")}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src="/images/logo-light.png" alt={t.liff.bookPageTitle} className="mx-auto h-16 w-auto" />
      <Stepper step={STEP_BY_STATUS[data.status]} t={t} />

      <div className="space-y-1 text-center">
        <h1 className="text-lg font-bold">{t.liffBook.requestTitle(data.code)}</h1>
        <span
          className={cn(
            "inline-block rounded-full px-3 py-1 text-xs font-medium",
            data.status === "NEEDS_RESCHEDULE" || data.status === "CANCELLED"
              ? "bg-destructive/10 text-destructive"
              : "bg-accent/40 text-primary"
          )}
        >
          {t.labels.bookingRequestStatus[data.status]}
        </span>
      </div>

      {data.status === "NEEDS_RESCHEDULE" && data.rescheduleReason && (
        <p className="rounded-2xl border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">
          {t.liffBook.rescheduleReason(data.rescheduleReason)}
        </p>
      )}

      <div className="space-y-3">
        {data.orders.map((o) => {
          const kind = orderKind(o);
          const Icon = KIND_ICONS[kind];
          const draft = drafts[o.id];
          const editing = o.status === "RESCHEDULE_REQUIRED" && data.status === "NEEDS_RESCHEDULE" && draft;
          return (
            <div key={o.id} className={cn("space-y-3 rounded-2xl border bg-card p-4", o.status === "CANCELLED" && "opacity-50")}>
              <div className="flex items-start gap-3">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-accent/40">
                  <Icon className="h-5 w-5 text-primary" />
                </span>
                <div className="min-w-0 flex-1 space-y-0.5 text-sm">
                  <div className="flex items-center gap-1 font-semibold">
                    {o.pet && <SpeciesIcon species={o.pet.species} className="h-4 w-4" />} {o.pet?.name} · {t.liffBook.kind[kind]}
                  </div>
                  {o.room && (
                    <div>
                      {o.room.category.name} · {o.room.name}
                    </div>
                  )}
                  <div className="text-muted-foreground">
                    {o.items
                      .filter((it) => it.itemType === "SERVICE")
                      .sort((a, b) => b.subtotal - a.subtotal)
                      .map((it) => it.name)
                      .join(" · ")}
                  </div>
                  {o.groomingStyleNote && (
                    <div className="text-muted-foreground">
                      {t.liffBook.styleTitle}: {o.groomingStyleNote}
                    </div>
                  )}
                  {!editing &&
                    (kind === "BOARDING" && o.checkInAt && o.checkOutAt ? (
                      <>
                        <div>{t.liff.confirmCheckInLine(formatDateLong(o.checkInAt), timeOf(o.checkInAt))}</div>
                        <div>{t.liff.confirmCheckOutLine(formatDateLong(o.checkOutAt), timeOf(o.checkOutAt))}</div>
                      </>
                    ) : o.appointmentAt ? (
                      <div>
                        {formatDateLong(o.appointmentAt)} {timeOf(o.appointmentAt)} {t.liff.timeUnitSuffix}
                      </div>
                    ) : null)}
                </div>
                <div className="shrink-0 text-right text-sm font-semibold">{formatBaht(o.total)}</div>
              </div>

              {editing &&
                (draft.kind === "BOARDING" ? (
                  <div className="grid gap-3 border-t pt-3 lg:grid-cols-2">
                    <div className="space-y-1.5">
                      <Label className="text-xs text-muted-foreground">{t.orders.form.checkInLabel}</Label>
                      <div className="grid grid-cols-[1fr_auto] gap-2">
                        <Input
                          type="date"
                          className="min-w-0"
                          min={todayStr()}
                          value={draft.date}
                          onChange={(e) => setDrafts({ ...drafts, [o.id]: { ...draft, date: e.target.value } })}
                        />
                        <Input
                          type="time"
                          className="w-28"
                          value={draft.checkInTime}
                          onChange={(e) => setDrafts({ ...drafts, [o.id]: { ...draft, checkInTime: e.target.value } })}
                        />
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
                          onChange={(e) => setDrafts({ ...drafts, [o.id]: { ...draft, checkOutDate: e.target.value } })}
                        />
                        <Input
                          type="time"
                          className="w-28"
                          value={draft.checkOutTime}
                          onChange={(e) => setDrafts({ ...drafts, [o.id]: { ...draft, checkOutTime: e.target.value } })}
                        />
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-4 border-t pt-3">
                    <SlotPicker
                      draft={draft}
                      set={(patch) => setDrafts((cur) => ({ ...cur, [o.id]: { ...cur[o.id], ...patch } }))}
                      t={t}
                    />
                  </div>
                ))}
            </div>
          );
        })}
      </div>

      <div className="space-y-2 rounded-2xl border bg-card p-4 text-sm">
        <div className="flex justify-between gap-3">
          <span>{t.liffBook.estimate}</span>
          <span className="font-semibold">{formatBaht(totalEstimate)}</span>
        </div>
        <div className="flex justify-between gap-3">
          <span>{t.liffBook.dueAfterApproval}</span>
          <span className="text-lg font-bold text-primary">{formatBaht(totalDue)}</span>
        </div>
        {hasBath && <p className="text-xs text-muted-foreground">{t.liffBook.depositNote}</p>}
      </div>

      {data.status === "NEEDS_RESCHEDULE" ? (
        <div className="fixed inset-x-3 bottom-3 z-10 mx-auto max-w-md sm:max-w-xl md:max-w-2xl lg:max-w-3xl">
          <Button className="h-14 w-full rounded-2xl text-base" disabled={!canResubmit || isPending} onClick={resubmit}>
            {isPending && <Loader2 className="animate-spin" />}
            {t.liffBook.resubmit}
          </Button>
        </div>
      ) : (
        <Button variant="outline" className="h-12 w-full rounded-2xl" onClick={() => router.push("/liff/book")}>
          {t.liffBook.newBooking}
        </Button>
      )}
    </div>
  );
}

export function LiffRequestView({ requestId }: { requestId: string }) {
  return (
    <LiffGate>
      <RequestBody requestId={requestId} />
    </LiffGate>
  );
}
