"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  Loader2,
  RefreshCw,
  CheckCircle2,
  XCircle,
  Clock,
  QrCode,
  Wallet,
  Image as ImageIcon,
} from "lucide-react";
import {
  regeneratePayment,
  verifyPayment,
  rejectPayment,
  createBalancePayment,
} from "@/app/actions/orders";
import type { PaymentStatus, PaymentPurpose, OrderStatus } from "@/generated/prisma/enums";
import { formatBaht } from "@/lib/format";
import { paymentStatusColor } from "@/lib/labels";
import { cn } from "@/lib/utils";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { useI18n } from "@/components/i18n-provider";

type PaymentRow = {
  id: string;
  purpose: PaymentPurpose;
  amount: number;
  status: PaymentStatus;
  qrPayload: string | null;
  expiresAt: string | null;
  slipUrl: string | null;
  rejectReason: string | null;
  bankAccount: { bankName: string; accountName: string; accountNumber: string } | null;
};

function useCountdown(expiresAt: string | null) {
  const [remaining, setRemaining] = useState<number>(() =>
    expiresAt ? Math.max(0, new Date(expiresAt).getTime() - Date.now()) : 0
  );
  useEffect(() => {
    if (!expiresAt) return;
    const tick = () =>
      setRemaining(Math.max(0, new Date(expiresAt).getTime() - Date.now()));
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [expiresAt]);
  return remaining;
}

export function PaymentPanel({
  orderId,
  orderStatus,
  orderTotal,
  extraChargesTotal = 0,
  payments,
  isQueueBooking = false,
}: {
  orderId: string;
  orderStatus: OrderStatus;
  orderTotal: number;
  /** ยอดค่าเสียหายเพิ่มเติมที่ยังไม่รวมอยู่ใน orderTotal — บวกรวมตอนเก็บยอดคงเหลือ */
  extraChargesTotal?: number;
  payments: PaymentRow[];
  isQueueBooking?: boolean;
}) {
  const { t } = useI18n();
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const amountOwed = orderTotal + extraChargesTotal;
  const verifiedSum = payments
    .filter((p) => p.status === "VERIFIED")
    .reduce((sum, p) => sum + p.amount, 0);
  const fullyPaid = verifiedSum >= amountOwed && amountOwed > 0;
  // เช็คเฉพาะรายการล่าสุด (payments เรียงจากเก่า→ใหม่) — ถ้ารายการล่าสุดยืนยันแล้ว ถือว่าไม่มีอะไรค้าง
  // แม้จะมีรายการเก่าที่เคยถูกปฏิเสธค้างอยู่ก่อนหน้าก็ตาม (เช่น ปฏิเสธแล้วสร้าง QR ใหม่แยกรายการ)
  const latestPayment = payments[payments.length - 1] ?? null;
  const activePayment = latestPayment && latestPayment.status !== "VERIFIED" ? latestPayment : null;
  // รายการที่ถูกปฏิเสธไม่ต้องโชว์ในสรุปยอด — เหลือแค่รายการที่ยังมีผลอยู่จริง
  const visiblePayments = payments.filter((p) => p.status !== "REJECTED");
  const showPurposeLabel = visiblePayments.length > 1;
  // สลิปที่ลูกค้าแนบมา — เก็บไว้ดูย้อนหลังได้เสมอผ่านปุ่มนี้ แม้ออเดอร์จะจ่ายครบแล้วจนการ์ด QR หายไปก็ตาม
  const paymentsWithSlip = payments.filter((p) => p.slipUrl);

  return (
    <Card className="lg:sticky lg:top-20">
      <CardHeader className="flex-row items-center justify-between">
        <CardTitle className="flex items-center gap-2 text-base">
          {t.orders.payment.title}
        </CardTitle>
        <div className="flex items-center gap-2">
          {paymentsWithSlip.length > 0 && <SlipViewerDialog payments={paymentsWithSlip} />}
          {activePayment && (
            <Badge variant="outline" className={cn("text-xs", paymentStatusColor[activePayment.status])}>
              {showPurposeLabel && `${t.labels.paymentPurpose[activePayment.purpose]} · `}
              {t.labels.paymentStatus[activePayment.status]}
            </Badge>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {visiblePayments.length > 1 && (
          <div className="space-y-1.5 rounded-lg border bg-muted/30 p-2.5 text-xs">
            {visiblePayments.map((p) => (
              <div key={p.id} className="flex items-center justify-between">
                <span className="text-muted-foreground">{t.labels.paymentPurpose[p.purpose]}</span>
                <div className="flex items-center gap-1.5">
                  <span className="font-medium">{formatBaht(p.amount)}</span>
                  <Badge variant="outline" className={cn("text-[10px]", paymentStatusColor[p.status])}>
                    {t.labels.paymentStatus[p.status]}
                  </Badge>
                </div>
              </div>
            ))}
          </div>
        )}

        {activePayment ? (
          <ActivePaymentPanel
            key={activePayment.id}
            orderStatus={orderStatus}
            payment={activePayment}
            showPurposeLabel={showPurposeLabel}
            isQueueBooking={isQueueBooking}
          />
        ) : fullyPaid ? (
          <div className="flex flex-col items-center gap-2 rounded-lg bg-emerald-50 p-6 text-center dark:bg-emerald-950/40">
            <CheckCircle2 className="h-12 w-12 text-emerald-600" />
            <div className="font-medium text-emerald-700 dark:text-emerald-400">
              {t.orders.payment.fullyPaid}
            </div>
          </div>
        ) : (
          <div className="space-y-3 rounded-lg bg-teal-50 p-4 text-center dark:bg-teal-950/30">
            <Wallet className="mx-auto h-8 w-8 text-teal-600" />
            <div>
              <div className="font-medium text-teal-800 dark:text-teal-300">
                {t.orders.payment.depositPaidLabel(formatBaht(verifiedSum))}
              </div>
              <div className="text-sm text-teal-700/80 dark:text-teal-400/80">
                {t.orders.payment.remainingLabel(formatBaht(amountOwed - verifiedSum))}
              </div>
            </div>
            {/* เก็บยอดคงเหลือได้ตั้งแต่เริ่มดำเนินการแล้ว — พนักงานขอ QR ให้ลูกค้าจ่ายหน้างานได้เลย ไม่ต้องรอเช็คเอ้าท์ก่อน */}
            {orderStatus !== "COMPLETED" && orderStatus !== "IN_PROGRESS" ? null : (
              <Button
                className="w-full"
                disabled={isPending}
                onClick={() =>
                  startTransition(async () => {
                    const res = await createBalancePayment(orderId);
                    if (!res.ok) toast.error(res.error);
                    else {
                      toast.success(res.message);
                      router.refresh();
                    }
                  })
                }
              >
                {isPending ? <Loader2 className="animate-spin" /> : <QrCode />}
                {t.orders.payment.collectBalance}
              </Button>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function SlipViewerDialog({ payments }: { payments: PaymentRow[] }) {
  const { t } = useI18n();
  const showPurposeLabel = payments.length > 1;

  return (
    <Dialog>
      <DialogTrigger
        render={
          <Button variant="outline" size="sm">
            <ImageIcon className="h-3.5 w-3.5" /> {t.orders.payment.viewSlipButton}
          </Button>
        }
      />
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{t.orders.payment.viewSlipButton}</DialogTitle>
        </DialogHeader>
        <div className="max-h-[70vh] space-y-4 overflow-y-auto">
          {payments.map((p) => (
            <div key={p.id} className="space-y-1.5">
              {showPurposeLabel && (
                <div className="text-xs font-medium text-muted-foreground">
                  {t.labels.paymentPurpose[p.purpose]} · {formatBaht(p.amount)}
                </div>
              )}
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={p.slipUrl!}
                alt={t.orders.payment.slipFromCustomer}
                className="mx-auto w-full rounded-lg border object-contain"
              />
            </div>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}

function ActivePaymentPanel({
  orderStatus,
  payment,
  showPurposeLabel,
  isQueueBooking,
}: {
  orderStatus: OrderStatus;
  payment: PaymentRow;
  showPurposeLabel: boolean;
  isQueueBooking: boolean;
}) {
  const { t } = useI18n();
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const remaining = useCountdown(payment.expiresAt);

  // สร้าง QR ฝั่งเบราว์เซอร์ จาก payload (เลี่ยงปัญหา serverless บน Vercel)
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);
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
      .then((url) => {
        if (active) setQrDataUrl(url);
      })
      .catch(() => {
        if (active) setQrDataUrl(null);
      });
    return () => {
      active = false;
    };
  }, [payment.qrPayload]);

  const isCancelled = orderStatus === "CANCELLED";
  const isExpired =
    isCancelled === false &&
    payment.status !== "SUBMITTED" &&
    payment.expiresAt !== null &&
    remaining <= 0;
  // QR ใช้ไม่ได้แล้ว (หมดอายุ หรือ ออเดอร์ถูกยกเลิก) → เบลอทิ้ง
  const isUnusable = isExpired || isCancelled;
  const mm = Math.floor(remaining / 60000);
  const ss = Math.floor((remaining % 60000) / 1000);
  const account = payment.bankAccount;

  function run(fn: () => Promise<{ ok: boolean; error?: string; message?: string }>) {
    startTransition(async () => {
      const res = await fn();
      if (!res.ok) toast.error(res.error);
      else {
        toast.success(res.message);
        router.refresh();
      }
    });
  }

  return (
    <>
      <div className="text-center">
        <div className="text-xs text-muted-foreground">
          {showPurposeLabel
            ? t.orders.payment.amountDueWithPurpose(t.labels.paymentPurpose[payment.purpose])
            : t.orders.payment.amountDue}
        </div>
        <div className="text-3xl font-bold text-primary">{formatBaht(payment.amount)}</div>
      </div>

      {isQueueBooking && payment.purpose === "DEPOSIT" && (
        <div className="rounded-lg border-2 border-red-600 bg-red-50 p-3 text-center dark:bg-red-950/40">
          <p className="text-xs leading-snug font-extrabold text-red-600 dark:text-red-400">
            {t.orders.payment.depositQueueWarning}
          </p>
        </div>
      )}

      {/* QR แบบ Thai QR Payment / PromptPay — ลูกค้าแนบสลิปมาแล้ว (SUBMITTED) ไม่ต้องโชว์อีก
          เพราะรอพนักงานตรวจสลิปด้านล่างแทน ไม่ใช่รอให้จ่ายเพิ่ม */}
      {payment.status !== "SUBMITTED" && (
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
                  <img
                    src={qrDataUrl}
                    alt="PromptPay QR"
                    width={220}
                    height={220}
                    className="mx-auto"
                  />
                  <div className="absolute top-1/2 left-1/2 flex h-9 w-9 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-md border-2 border-[#0b2f6b] bg-white shadow">
                    <QrCode className="h-4 w-4 text-[#0b2f6b]" />
                  </div>
                </div>
              ) : (
                <div className="flex h-[220px] w-[220px] items-center justify-center text-center text-sm text-zinc-400">
                  {t.orders.payment.noQrYet}<br />{t.orders.payment.noQrHint}
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
                <div className="mt-1 text-xs text-zinc-500">{t.orders.payment.accountLabel}{account.accountName}</div>
                <div className="text-xs tracking-wide text-zinc-400">
                  {t.orders.payment.refNumber}{account.accountNumber}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Countdown */}
      {!isUnusable && payment.expiresAt && payment.status !== "SUBMITTED" && (
        <div className="flex items-center justify-center gap-1.5 text-sm">
          <Clock className="h-4 w-4 text-amber-600" />
          <span className="text-muted-foreground">{t.orders.payment.timeRemaining}</span>
          <span className="font-mono font-semibold tabular-nums">
            {String(mm).padStart(2, "0")}:{String(ss).padStart(2, "0")}
          </span>
        </div>
      )}

      {!isCancelled && payment.status !== "SUBMITTED" && (
        <Button
          variant="outline"
          className="w-full"
          onClick={() => run(() => regeneratePayment(payment.id))}
          disabled={isPending}
        >
          {isPending ? <Loader2 className="animate-spin" /> : <RefreshCw />}
          {t.orders.payment.regenerateQr}
        </Button>
      )}

      {payment.rejectReason && payment.status === "REJECTED" && (
        <div className="rounded-lg bg-rose-50 p-3 text-center text-xs text-rose-700 dark:bg-rose-950/40 dark:text-rose-400">
          {t.orders.payment.rejectedReason(payment.rejectReason)}
        </div>
      )}

      {/* สลิปที่ลูกค้าแนบมาเอง (ผ่านหน้าจ่ายเงินฝั่ง LINE) — เผื่อกรณี API เช็คสลิปอัตโนมัติใช้งานไม่ได้
          พนักงานยังตรวจด้วยตาตรงนี้ได้เสมอ ก่อนกดยืนยัน/ปฏิเสธด้านล่าง */}
      {payment.slipUrl && (
        <div className="space-y-1.5">
          <div className="text-xs font-medium text-muted-foreground">{t.orders.payment.slipFromCustomer}</div>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={payment.slipUrl}
            alt={t.orders.payment.slipFromCustomer}
            className="mx-auto max-h-80 w-full rounded-lg border object-contain"
          />
        </div>
      )}

      {/* Admin actions — แสดงได้ตราบใดที่มี payment ค้างอยู่และออเดอร์ยังไม่ถูกยกเลิก (แม้งานจะเสร็จ/เช็คเอาท์ไปแล้วก็ยืนยันยอดคงเหลือย้อนหลังได้) */}
      {orderStatus !== "CANCELLED" && (
        <div className="space-y-2 border-t pt-3">
          <div className="text-xs font-medium text-muted-foreground">
            {t.orders.payment.adminVerification}
          </div>
          <div className="grid grid-cols-2 gap-2">
            <Button
              className="bg-emerald-600 hover:bg-emerald-700"
              onClick={() => run(() => verifyPayment(payment.id))}
              disabled={isPending}
            >
              <CheckCircle2 /> {t.orders.payment.verify}
            </Button>
            <Button
              variant="destructive"
              onClick={() => run(() => rejectPayment(payment.id, t.orders.payment.rejectReasonDefault))}
              disabled={isPending}
            >
              <XCircle /> {t.orders.payment.reject}
            </Button>
          </div>
        </div>
      )}
    </>
  );
}
