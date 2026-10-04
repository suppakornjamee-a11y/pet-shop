"use client";

import { useCallback, useEffect, useState, useTransition } from "react";
import { toast } from "sonner";
import { Bath, CalendarDays, Check, Clock, Home, Hourglass, Loader2, LogIn, LogOut, Scissors, X } from "lucide-react";
import { liffCancelOrder, liffGetBookingRequest, liffRescheduleBookingRequest } from "@/app/actions/liff";
import { formatBaht, formatDateLong, formatTime } from "@/lib/format";
import { toThaiDateStr } from "@/lib/slots";
import { cn } from "@/lib/utils";
import { useLiff, LiffGate, handleLiffAuthExpiry } from "@/components/liff-provider";
import { useI18n } from "@/components/i18n-provider";
import { useConfirm } from "@/components/confirm-provider";
import { LiffPaymentBody } from "@/components/liff-payment-view";
import { LiffTabs } from "@/components/liff-tabs";
import { SpeciesIcon } from "@/components/species-icon";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { SlotPicker } from "./item-detail";
import { newItemDraft, type ItemDraft } from "./cart";
import { Stepper, todayStr, type Kind, type Step, type T } from "./shared";

type RequestData = Extract<Awaited<ReturnType<typeof liffGetBookingRequest>>, { ok: true }>;
type RequestOrder = RequestData["orders"][number];

const POLL_MS = 8000;
const KIND_ICONS: Record<Kind, typeof Home> = { BOARDING: Home, BATH: Bath, OTHER: Scissors };
/** สถานะที่ลูกค้ายกเลิกเองได้ — ตรงกับ CUSTOMER_CANCELLABLE_STATUSES ใน src/app/actions/liff.ts เป๊ะๆ */
const CANCELLABLE_STATUSES = new Set(["PENDING_APPROVAL", "RESCHEDULE_REQUIRED", "PENDING_PAYMENT", "DEPOSIT_PAID", "PAID"]);

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

/** กล่องข้อมูลย่อยในการ์ดสรุป — ไอคอน + ค่า อยู่แถวเดียวกัน (ไม่มีป้ายชื่อ) ใช้คู่กันในกริด 2 คอลัมน์ */
function InfoBox({ icon: Icon, children }: { icon: typeof Clock; children: React.ReactNode }) {
  return (
    <div className="flex min-w-0 items-center gap-2 rounded-2xl bg-accent/20 p-2.5">
      <Icon className="h-4 w-4 shrink-0 text-primary" />
      <p className="truncate text-sm font-semibold">{children}</p>
    </div>
  );
}

/** การ์ดสรุปรายการ — หัวบอกบริการ/สัตว์/ราคา ตามด้วยกล่องวันเวลา แล้วเช็คลิสต์รายการบริการที่รวมอยู่ */
function SummaryCard({ order, t, showPaid = false }: { order: RequestOrder; t: T; showPaid?: boolean }) {
  const kind = orderKind(order);
  const Icon = KIND_ICONS[kind];
  const services = order.items.filter((it) => it.itemType === "SERVICE").sort((a, b) => b.subtotal - a.subtotal);
  return (
    <div className="space-y-3 rounded-3xl border bg-card p-4 shadow-[0_2px_10px_rgba(0,0,0,0.04)]">
      <div className="flex items-start gap-3">
        <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-primary/10 text-primary">
          <Icon className="h-5 w-5" />
        </span>
        <div className="min-w-0 flex-1">
          <div className="font-bold leading-tight">{t.liffBook.summaryKind[kind]}</div>
          {order.pet && (
            <div className="mt-0.5 flex items-center gap-1 text-xs text-muted-foreground">
              <SpeciesIcon species={order.pet.species} className="h-3.5 w-3.5" />
              {order.pet.name} · {t.labels.species[order.pet.species]}
            </div>
          )}
          {order.room && (
            <div className="mt-0.5 text-xs text-muted-foreground">
              {order.room.category.name} · {order.room.name}
            </div>
          )}
          {order.groomingStyleNote && (
            <div className="mt-0.5 text-xs text-muted-foreground">
              {t.liffBook.styleTitle}: {order.groomingStyleNote}
            </div>
          )}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2">
        {kind === "BOARDING" && order.checkInAt && order.checkOutAt ? (
          <>
            <InfoBox icon={LogIn}>
              {formatDateLong(order.checkInAt)} {timeOf(order.checkInAt)} {t.liff.timeUnitSuffix}
            </InfoBox>
            <InfoBox icon={LogOut}>
              {formatDateLong(order.checkOutAt)} {timeOf(order.checkOutAt)} {t.liff.timeUnitSuffix}
            </InfoBox>
          </>
        ) : order.appointmentAt ? (
          <>
            <InfoBox icon={CalendarDays}>{formatDateLong(order.appointmentAt)}</InfoBox>
            <InfoBox icon={Clock}>
              {timeOf(order.appointmentAt)} {t.liff.timeUnitSuffix}
            </InfoBox>
          </>
        ) : null}
      </div>

      {services.length > 0 && (
        <div className="space-y-2 border-t pt-3">
          <div className="text-sm font-bold">{t.liffBook.servicesCount(services.length)}</div>
          <div className="grid grid-cols-2 gap-x-3 gap-y-2 text-xs">
            {services.map((it, i) => (
              <div key={`${it.name}-${i}`} className="flex items-center gap-1.5">
                <Check className="h-3.5 w-3.5 shrink-0 text-primary" strokeWidth={3} />
                <span className="truncate">{it.name}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {showPaid && (
        <dl className="space-y-2 rounded-2xl bg-accent/20 p-3 text-sm">
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
        </dl>
      )}
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

/** หัวสถานะ — wait = รอแอดมินตรวจสอบ (นาฬิกาทราย) · ok = สำเร็จ · bad = มีปัญหา — กล่องแบนสีพื้น ไม่มีไล่สี/เคลื่อนไหว */
function StatusHero({ tone, title, children }: { tone: "ok" | "wait" | "bad"; title: string; children?: React.ReactNode }) {
  const bad = tone === "bad";
  const ok = tone === "ok";
  const Icon = bad ? X : tone === "wait" ? Hourglass : Check;
  return (
    <div className={cn("space-y-3 rounded-2xl p-3.5", bad ? "bg-destructive/10" : ok ? "bg-emerald-50" : "bg-accent/40")}>
      <div className="flex items-center gap-2.5">
        <span
          className={cn(
            "flex h-8 w-8 shrink-0 items-center justify-center rounded-full",
            bad ? "bg-destructive/10 text-destructive" : ok ? "bg-emerald-100 text-emerald-600" : "bg-primary/10 text-primary"
          )}
        >
          <Icon className="h-4 w-4" strokeWidth={tone === "wait" ? 2.25 : 3} />
        </span>
        <h1 className="text-sm font-bold">{title}</h1>
      </div>
      {children}
    </div>
  );
}

/** ปุ่มยกเลิกการจอง — แบบเดียวใช้ซ้ำทุกสถานะที่ยกเลิกได้ ไม่เน้นสี (ไม่ใช่ปุ่มหลักของหน้า) */
function CancelOrderButton({ onClick, t }: { onClick: () => void; t: T }) {
  return (
    <Button type="button" variant="outline" className="w-full rounded-2xl" onClick={onClick}>
      {t.liff.cancelBookingButton}
    </Button>
  );
}

/** เลือกคืนเงินหรือเก็บเป็นเครดิต — ขึ้นเฉพาะตอนยกเลิกออเดอร์ที่มีเงินชำระไปแล้ว (มัดจำ/เต็มจำนวน) */
function RefundOrCreditDialog({
  open,
  amount,
  pending,
  onChoose,
  onClose,
  t,
}: {
  open: boolean;
  amount: number;
  pending: boolean;
  onChoose: (choice: "refund" | "credit") => void;
  onClose: () => void;
  t: T;
}) {
  return (
    <Dialog open={open} onOpenChange={(v) => !v && !pending && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t.liff.refundOrCreditTitle}</DialogTitle>
          <DialogDescription>{t.liff.refundOrCreditDescription(formatBaht(amount))}</DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button type="button" variant="outline" disabled={pending} onClick={() => onChoose("refund")}>
            {t.liff.chooseRefund}
          </Button>
          <Button type="button" disabled={pending} onClick={() => onChoose("credit")}>
            {t.liff.chooseCredit}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
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
  const confirm = useConfirm();
  // ออเดอร์ที่กำลังยกเลิกอยู่ + ยอดที่เลือกคืนเงิน/เก็บเครดิตได้ — ไม่ null เมื่อต้องเปิด dialog เลือก
  const [cancelChoice, setCancelChoice] = useState<{ orderId: string; amount: number } | null>(null);
  const [cancelPending, setCancelPending] = useState(false);

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

  /** ยกเลิกออเดอร์ — ถ้ามีเงินชำระไปแล้ว server จะตอบ needsChoice กลับมาแทนที่จะยกเลิกทันที ให้เปิด dialog เลือกต่อ */
  async function runCancel(orderId: string, choice?: "refund" | "credit") {
    if (!idToken) return;
    setCancelPending(true);
    const res = await liffCancelOrder(idToken, orderId, { choice });
    setCancelPending(false);
    if (!res.ok && res.needsChoice) {
      setCancelChoice({ orderId, amount: res.refundableAmount ?? 0 });
      return;
    }
    if (!res.ok) {
      handleLiffAuthExpiry(res);
      toast.error(res.error);
      return;
    }
    setCancelChoice(null);
    toast.success(res.message);
    await load();
  }

  async function handleCancelClick(orderId: string) {
    const ok = await confirm({
      title: t.liff.confirmCancelBookingTitle,
      confirmLabel: t.liff.cancelBookingButton,
      cancelLabel: t.common.no,
      tone: "danger",
    });
    if (ok) await runCancel(orderId);
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
      <h1 className="text-lg font-bold">{t.liff.ordersPageTitle}</h1>
      <Stepper step={stepOf(selected)} t={t} />

      {data.orders.length > 1 && (
        <div className="flex gap-1 rounded-2xl bg-muted/60 p-1">
          {data.orders.map((o) => {
            const active = o.id === selected.id;
            return (
              <button
                key={o.id}
                type="button"
                onClick={() => setSelectedId(o.id)}
                className={cn(
                  "relative min-w-0 flex-1 rounded-xl px-2 py-2 text-center transition-colors",
                  active ? "bg-card font-semibold text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground",
                  o.status === "CANCELLED" && "opacity-50"
                )}
              >
                <span className="block truncate text-sm">{o.pet?.name}</span>
                <span className="block truncate text-[0.6875rem] font-normal text-muted-foreground">
                  {t.liffBook.kind[orderKind(o)]}
                </span>
                {needsAction(o) && <span className="absolute right-1.5 top-1.5 h-1.5 w-1.5 rounded-full bg-destructive" />}
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
          <CancelOrderButton onClick={() => handleCancelClick(selected.id)} t={t} />
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
              <SlotPicker key={selected.id} draft={draft} set={setDraft} cart={[]} editingKey={null} t={t} />
            ))}
          <div className="fixed inset-x-3 bottom-3 z-10 mx-auto max-w-md space-y-2 sm:max-w-xl md:max-w-2xl lg:max-w-3xl">
            <Button className="h-14 w-full rounded-2xl text-base" disabled={!canResubmit || isPending} onClick={() => resubmit(selected)}>
              {isPending && <Loader2 className="animate-spin" />}
              {t.common.confirm}
            </Button>
            <CancelOrderButton onClick={() => handleCancelClick(selected.id)} t={t} />
          </div>
        </>
      ) : selected.status === "PENDING_APPROVAL" ? (
        <>
          <StatusHero tone="wait" title={t.liff.checkingQueueTitle}>
            <StatusPill>{t.labels.bookingRequestStatus.PENDING_APPROVAL}</StatusPill>
          </StatusHero>
          <SummaryCard order={selected} t={t} />
          <CancelOrderButton onClick={() => handleCancelClick(selected.id)} t={t} />
        </>
      ) : selected.status === "CANCELLED" ? (
        <>
          <StatusHero tone="bad" title={t.labels.orderStatus.CANCELLED} />
          <SummaryCard order={selected} t={t} />
        </>
      ) : (
        <>
          <div className="flex items-center gap-3 rounded-2xl border bg-card p-4 shadow-[0_2px_10px_rgba(0,0,0,0.04)]">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground">
              <Check className="h-4 w-4" strokeWidth={3} />
            </span>
            <div className="min-w-0">
              <p className="font-bold leading-tight">{t.labels.bookingRequestStatus.CONFIRMED}</p>
              <p className="mt-0.5 text-xs font-medium text-primary">{t.liff.inProgressTitle}</p>
            </div>
          </div>
          <SummaryCard order={selected} t={t} showPaid />
          {isBath && selected.paid < selected.total && (
            <p className="text-center text-xs text-muted-foreground">{t.liffBook.depositNote}</p>
          )}
          {CANCELLABLE_STATUSES.has(selected.status) && (
            <CancelOrderButton onClick={() => handleCancelClick(selected.id)} t={t} />
          )}
        </>
      )}

      {selected.status !== "RESCHEDULE_REQUIRED" && <LiffTabs />}

      <RefundOrCreditDialog
        open={cancelChoice !== null}
        amount={cancelChoice?.amount ?? 0}
        pending={cancelPending}
        onChoose={(choice) => cancelChoice && void runCancel(cancelChoice.orderId, choice)}
        onClose={() => setCancelChoice(null)}
        t={t}
      />
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
