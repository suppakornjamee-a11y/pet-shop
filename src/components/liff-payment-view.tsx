"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Loader2, CheckCircle2, XCircle, Clock, QrCode, PartyPopper, Paperclip } from "lucide-react";
import { getLiffOrderPaymentStatus, liffSubmitPaymentSlip } from "@/app/actions/liff";
import { formatBaht } from "@/lib/format";
import { fileToDataUrl } from "@/lib/file";
import { cn } from "@/lib/utils";
import { useLiff, LiffGate, handleLiffAuthExpiry } from "@/components/liff-provider";
import { useI18n } from "@/components/i18n-provider";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";

type PaymentRow = {
  id: string;
  purpose: "DEPOSIT" | "BALANCE";
  amount: number;
  status: "PENDING" | "SUBMITTED" | "VERIFIED" | "REJECTED" | "EXPIRED";
  qrPayload: string | null;
  expiresAt: string | null;
  bankAccount: { bankName: string; accountName: string; accountNumber: string } | null;
};
type OrderStatusVal = "PENDING_PAYMENT" | "DEPOSIT_PAID" | "PAID" | "IN_PROGRESS" | "COMPLETED" | "CANCELLED";
type OrderItemRow = { id: string; name: string; quantity: number; unitPrice: number; subtotal: number };
type ExtraChargeRow = { id: string; description: string; amount: number };
type OrderDetail = {
  createdAt: string;
  note: string | null;
  appointmentAt: string | null;
  checkInAt: string | null;
  checkOutAt: string | null;
  nights: number;
  holidaySurcharge: number;
  holidayLabel: string | null;
  ownerName: string;
  pet: { name: string; species: string; allergies: string | null } | null;
  room: { name: string; category: { name: string } } | null;
  items: OrderItemRow[];
  extraCharges: ExtraChargeRow[];
};

const POLL_MS = 8000;
const TERMINAL_ORDER_STATUSES: OrderStatusVal[] = ["CANCELLED"];

function useCountdown(expiresAt: string | null) {
  const [remaining, setRemaining] = useState<number>(() =>
    expiresAt ? Math.max(0, new Date(expiresAt).getTime() - Date.now()) : 0
  );
  useEffect(() => {
    if (!expiresAt) return;
    const tick = () => setRemaining(Math.max(0, new Date(expiresAt).getTime() - Date.now()));
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [expiresAt]);
  return remaining;
}

function QrBlock({ payment, orderStatus }: { payment: PaymentRow; orderStatus: OrderStatusVal }) {
  const { t } = useI18n();
  const { idToken } = useLiff();
  const remaining = useCountdown(payment.expiresAt);
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);
  const [slipPreview, setSlipPreview] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [justSubmitted, setJustSubmitted] = useState(false);

  // เลือกรูปแค่พรีวิวไว้ก่อน ยังไม่ส่งจนกว่าจะกดยืนยัน — เผื่อเลือกรูปผิดจะได้เปลี่ยนก่อนส่งจริง
  async function handleSlipFileSelect(file: File) {
    try {
      const dataUrl = await fileToDataUrl(file);
      setSlipPreview(dataUrl);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : t.liff.errorTitle);
    }
  }

  async function confirmSlip() {
    if (!idToken || !slipPreview) return;
    setUploading(true);
    try {
      const res = await liffSubmitPaymentSlip(idToken, payment.id, slipPreview);
      if (!res.ok) {
        handleLiffAuthExpiry(res);
        toast.error(res.error);
        return;
      }
      setJustSubmitted(true);
      toast.success(res.message);
    } finally {
      setUploading(false);
    }
  }

  useEffect(() => {
    if (!payment.qrPayload) return;
    let active = true;
    import("qrcode")
      .then((mod) =>
        mod.default.toDataURL(payment.qrPayload!, {
          errorCorrectionLevel: "M",
          margin: 1,
          width: 320,
          color: { dark: "#0f172a", light: "#ffffff" },
        })
      )
      .then((url) => active && setQrDataUrl(url))
      .catch(() => active && setQrDataUrl(null));
    return () => {
      active = false;
    };
  }, [payment.qrPayload]);

  const isCancelled = orderStatus === "CANCELLED";
  const isSubmitted = payment.status === "SUBMITTED" || justSubmitted;
  const isExpired = !isCancelled && !isSubmitted && payment.expiresAt !== null && remaining <= 0;
  const isUnusable = isExpired || isCancelled;
  const mm = Math.floor(remaining / 60000);
  const ss = Math.floor((remaining % 60000) / 1000);
  const account = payment.bankAccount;

  return (
    <div className="space-y-4">
      <div className="text-center">
        <div className="text-xs text-muted-foreground">{t.orders.payment.amountDue}</div>
        <div className="text-3xl font-bold text-primary">{formatBaht(payment.amount)}</div>
      </div>

      <div className="mx-auto w-fit rounded-[28px] bg-emerald-500 p-3.5 shadow-sm">
        <div className="overflow-hidden rounded-3xl bg-white">
          <div className="flex items-center justify-center gap-2.5 bg-[#0b2f6b] px-6 py-3 text-white">
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-white/15">
              <QrCode className="h-4.5 w-4.5" />
            </span>
            <div className="text-left text-sm leading-tight font-extrabold tracking-wide">
              <div>THAI QR</div>
              <div>PAYMENT</div>
            </div>
          </div>
          <div className="flex flex-col items-center gap-0.5 pt-3">
            <span className="text-[9px] font-medium text-[#0b2f6b]">พร้อมเพย์</span>
            <div className="flex overflow-hidden rounded border border-[#0b2f6b] text-xs font-bold">
              <span className="px-1.5 py-0.5 text-[#0b2f6b]">Prompt</span>
              <span className="bg-[#0b2f6b] px-1.5 py-0.5 text-white">Pay</span>
            </div>
          </div>
          <div className="relative p-4">
            {qrDataUrl ? (
              <div className={cn("relative transition", isUnusable && "opacity-30 blur-[2px]")}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={qrDataUrl} alt="PromptPay QR" width={220} height={220} className="mx-auto" />
                <div className="absolute top-1/2 left-1/2 flex h-9 w-9 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-md border-2 border-[#0b2f6b] bg-white shadow">
                  <QrCode className="h-4 w-4 text-[#0b2f6b]" />
                </div>
              </div>
            ) : (
              <div className="flex h-[220px] w-[220px] items-center justify-center text-center text-sm text-zinc-400">
                {t.orders.payment.noQrYet}
                <br />
                {t.orders.payment.noQrHint}
              </div>
            )}
            {isUnusable && (
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-1 bg-white/70 text-center">
                {isCancelled ? (
                  <>
                    <XCircle className="h-8 w-8 text-rose-500" />
                    <span className="font-medium text-zinc-800">{t.orders.payment.orderCancelled}</span>
                  </>
                ) : (
                  <>
                    <Clock className="h-8 w-8 text-zinc-500" />
                    <span className="font-medium text-zinc-800">{t.orders.payment.qrExpired}</span>
                  </>
                )}
              </div>
            )}
          </div>
          {account && (
            <div className="px-4 pb-4 text-center">
              <div className="text-base font-bold text-zinc-800">{account.accountName}</div>
              <div className="mt-1 text-xs text-zinc-500">
                {t.orders.payment.accountLabel}
                {account.accountName}
              </div>
              <div className="text-xs tracking-wide text-zinc-400">
                {t.orders.payment.refNumber}
                {account.accountNumber}
              </div>
            </div>
          )}
        </div>
      </div>

      {!isUnusable && payment.expiresAt && !isSubmitted && (
        <div className="flex items-center justify-center gap-1.5 text-sm">
          <Clock className="h-4 w-4 text-amber-600" />
          <span className="text-muted-foreground">{t.orders.payment.timeRemaining}</span>
          <span className="font-mono font-semibold tabular-nums">
            {String(mm).padStart(2, "0")}:{String(ss).padStart(2, "0")}
          </span>
        </div>
      )}

      {!isUnusable && !isSubmitted && slipPreview && (
        <div className="space-y-2">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={slipPreview} alt={t.liff.attachSlipButton} className="mx-auto h-40 w-40 rounded-lg border object-cover" />
          <div className="grid grid-cols-2 gap-2">
            <label className="flex cursor-pointer items-center justify-center gap-1.5 rounded-lg border p-2.5 text-sm text-muted-foreground transition-colors hover:bg-accent/50">
              {t.liff.reselectSlipButton}
              <input
                type="file"
                accept="image/*"
                className="hidden"
                disabled={uploading}
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) handleSlipFileSelect(file);
                }}
              />
            </label>
            <Button onClick={confirmSlip} disabled={uploading}>
              {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
              {t.liff.confirmSlipButton}
            </Button>
          </div>
        </div>
      )}

      {!isUnusable && !isSubmitted && !slipPreview && (
        <label className="flex cursor-pointer items-center justify-center gap-2 rounded-lg border border-dashed p-3 text-sm text-muted-foreground transition-colors hover:bg-accent/50">
          <Paperclip className="h-4 w-4" />
          {t.liff.attachSlipButton}
          <input
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) handleSlipFileSelect(file);
            }}
          />
        </label>
      )}

      {isExpired ? (
        <p className="rounded-lg bg-amber-50 p-3 text-center text-xs text-amber-800 dark:bg-amber-950/40 dark:text-amber-300">
          {t.liff.qrExpiredContactShop}
        </p>
      ) : isSubmitted ? (
        <p className="rounded-lg bg-emerald-50 p-3 text-center text-xs text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400">
          {t.liff.slipSubmittedNotice}
        </p>
      ) : !isCancelled ? (
        <p className="rounded-lg bg-muted/50 p-3 text-center text-xs text-muted-foreground">
          {t.liff.waitingForShopNotice}
        </p>
      ) : null}
    </div>
  );
}

function OrderSummaryCard({ detail, total }: { detail: OrderDetail; total: number }) {
  const { t } = useI18n();
  const intlLocale = "th-TH";
  const extraChargesTotal = detail.extraCharges.reduce((sum, c) => sum + c.amount, 0);

  return (
    <div className="space-y-3 rounded-xl border p-4">
      {detail.appointmentAt && (
        <div className="flex items-center gap-2 rounded-lg bg-primary/10 px-3 py-2 text-sm font-medium text-primary">
          <Clock className="h-4 w-4" />
          {t.orders.queueLabel(
            new Intl.DateTimeFormat(intlLocale, {
              dateStyle: "long",
              timeStyle: "short",
              timeZone: "Asia/Bangkok",
            }).format(new Date(detail.appointmentAt))
          )}
        </div>
      )}

      {detail.room && detail.checkInAt && detail.checkOutAt && (
        <div className="space-y-2 rounded-lg border bg-muted/30 p-3 text-sm">
          <div className="font-medium">
            {detail.room.category.name} · {detail.room.name}
            {detail.nights > 0 && ` · ${t.orders.nightsLabel(detail.nights)}`}
          </div>
          <div className="grid gap-1 text-xs text-muted-foreground sm:grid-cols-2">
            <div>
              {t.orders.checkIn}:{" "}
              {new Intl.DateTimeFormat(intlLocale, {
                dateStyle: "medium",
                timeStyle: "short",
                timeZone: "Asia/Bangkok",
              }).format(new Date(detail.checkInAt))}
            </div>
            <div>
              {t.orders.checkOut}:{" "}
              {new Intl.DateTimeFormat(intlLocale, {
                dateStyle: "medium",
                timeStyle: "short",
                timeZone: "Asia/Bangkok",
              }).format(new Date(detail.checkOutAt))}
            </div>
          </div>
        </div>
      )}

      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <div className="text-xs text-muted-foreground">{t.orders.owner}</div>
          <div className="text-sm font-medium">{detail.ownerName}</div>
        </div>
        {detail.pet && (
          <div>
            <div className="text-xs text-muted-foreground">{t.orders.pet}</div>
            <div className="text-sm font-medium">{detail.pet.name}</div>
            {detail.pet.allergies && (
              <div className="text-xs text-rose-600">{t.orders.allergyWarning(detail.pet.allergies)}</div>
            )}
          </div>
        )}
      </div>

      <div className="overflow-hidden rounded-lg border">
        <table className="w-full text-sm">
          <thead className="bg-muted/50 text-muted-foreground">
            <tr>
              <th className="px-3 py-2 text-left font-medium">{t.orders.columnItem}</th>
              <th className="px-3 py-2 text-center font-medium">{t.orders.columnQty}</th>
              <th className="px-3 py-2 text-right font-medium">{t.orders.columnPrice}</th>
              <th className="px-3 py-2 text-right font-medium">{t.orders.columnSubtotal}</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {detail.items.map((it) => (
              <tr key={it.id}>
                <td className="px-3 py-2">{it.name}</td>
                <td className="px-3 py-2 text-center">{it.quantity}</td>
                <td className="px-3 py-2 text-right">{formatBaht(it.unitPrice)}</td>
                <td className="px-3 py-2 text-right font-medium">{formatBaht(it.subtotal)}</td>
              </tr>
            ))}
            {detail.extraCharges.map((c) => (
              <tr key={c.id} className="text-red-600">
                <td className="px-3 py-2">
                  {c.description} ({t.orders.extraCharges.title})
                </td>
                <td className="px-3 py-2 text-center">1</td>
                <td className="px-3 py-2 text-right">{formatBaht(c.amount)}</td>
                <td className="px-3 py-2 text-right font-medium">{formatBaht(c.amount)}</td>
              </tr>
            ))}
          </tbody>
          <tfoot className="border-t bg-muted/30">
            {detail.holidaySurcharge > 0 && (
              <tr>
                <td colSpan={3} className="px-3 py-2 text-right font-semibold text-red-600">
                  {t.orders.holidaySurchargeLabel(detail.holidayLabel ?? "")}
                </td>
                <td className="px-3 py-2 text-right font-bold text-red-600">
                  +{formatBaht(detail.holidaySurcharge)}
                </td>
              </tr>
            )}
            <tr>
              <td colSpan={3} className="px-3 py-2 text-right font-semibold">
                {t.orders.grandTotal}
              </td>
              <td className="px-3 py-2 text-right text-base font-bold text-primary">
                {formatBaht(total + extraChargesTotal)}
              </td>
            </tr>
          </tfoot>
        </table>
      </div>

      {detail.note && (
        <div className="rounded-lg bg-muted/40 p-3 text-sm">
          <span className="text-muted-foreground">{t.orders.noteLabel}</span> {detail.note}
        </div>
      )}
    </div>
  );
}

function PaymentBody({ orderId }: { orderId: string }) {
  const { t } = useI18n();
  const { idToken } = useLiff();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [orderCode, setOrderCode] = useState("");
  const [status, setStatus] = useState<OrderStatusVal>("PENDING_PAYMENT");
  const [total, setTotal] = useState(0);
  const [payments, setPayments] = useState<PaymentRow[]>([]);
  const [detail, setDetail] = useState<OrderDetail | null>(null);

  useEffect(() => {
    if (!idToken) return;
    let active = true;
    let timeoutId: ReturnType<typeof setTimeout>;

    async function poll() {
      const res = await getLiffOrderPaymentStatus(idToken!, orderId);
      if (!active) return;
      if (!res.ok) {
        handleLiffAuthExpiry(res);
        setError(res.error);
        setLoading(false);
        return;
      }
      setOrderCode(res.orderCode);
      setStatus(res.status as OrderStatusVal);
      setTotal(res.total);
      setPayments(res.payments as PaymentRow[]);
      setDetail({
        createdAt: res.createdAt,
        note: res.note,
        appointmentAt: res.appointmentAt,
        checkInAt: res.checkInAt,
        checkOutAt: res.checkOutAt,
        nights: res.nights,
        holidaySurcharge: res.holidaySurcharge,
        holidayLabel: res.holidayLabel,
        ownerName: res.ownerName,
        pet: res.pet,
        room: res.room,
        items: res.items,
        extraCharges: res.extraCharges,
      });
      setLoading(false);
      const verifiedSum = res.payments.filter((p) => p.status === "VERIFIED").reduce((s, p) => s + p.amount, 0);
      const fullyPaid = verifiedSum >= res.total;
      const shouldKeepPolling = !TERMINAL_ORDER_STATUSES.includes(res.status as OrderStatusVal) && !fullyPaid;
      if (shouldKeepPolling) timeoutId = setTimeout(poll, POLL_MS);
    }
    poll();
    return () => {
      active = false;
      clearTimeout(timeoutId);
    };
  }, [idToken, orderId]);

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

  const verifiedSum = payments.filter((p) => p.status === "VERIFIED").reduce((s, p) => s + p.amount, 0);
  const fullyPaid = verifiedSum >= total && total > 0;
  const latestPayment = payments[payments.length - 1] ?? null;
  const activePayment = latestPayment && latestPayment.status !== "VERIFIED" ? latestPayment : null;

  return (
    <div className="space-y-5">
      <PageHeader title={t.liff.payPageTitle} description={t.liff.orderCodeLabel(orderCode)} />

      {detail && <OrderSummaryCard detail={detail} total={total} />}

      {activePayment ? (
        <QrBlock payment={activePayment} orderStatus={status} />
      ) : fullyPaid ? (
        <div className="flex flex-col items-center gap-3 rounded-lg bg-emerald-50 p-8 text-center dark:bg-emerald-950/40">
          <PartyPopper className="h-12 w-12 text-emerald-600" />
          <div className="font-medium text-emerald-700 dark:text-emerald-400">
            {t.orders.payment.fullyPaid}
          </div>
          <div className="text-sm text-emerald-700/80 dark:text-emerald-400/80">
            {t.labels.orderStatus[status]}
          </div>
        </div>
      ) : (
        <div className="flex flex-col items-center gap-2 rounded-lg bg-muted/40 p-8 text-center">
          <CheckCircle2 className="h-10 w-10 text-muted-foreground" />
          <div className="text-sm text-muted-foreground">{t.labels.orderStatus[status]}</div>
        </div>
      )}
    </div>
  );
}

export function LiffPaymentView({ orderId }: { orderId: string }) {
  return (
    <LiffGate>
      <PaymentBody orderId={orderId} />
    </LiffGate>
  );
}
