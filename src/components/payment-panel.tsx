"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  Loader2,
  RefreshCw,
  CheckCircle2,
  XCircle,
  Upload,
  Clock,
  QrCode,
} from "lucide-react";
import {
  regeneratePayment,
  verifyPayment,
  rejectPayment,
  markSlipSubmitted,
} from "@/app/actions/orders";
import type { PaymentStatus, OrderStatus } from "@/generated/prisma/enums";
import { formatBaht } from "@/lib/format";
import { paymentStatusLabel, paymentStatusColor } from "@/lib/labels";
import { cn } from "@/lib/utils";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

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
  qrPayload,
  amount,
  status,
  expiresAt,
  rejectReason,
  account,
}: {
  orderId: string;
  orderStatus: OrderStatus;
  qrPayload: string | null;
  amount: number;
  status: PaymentStatus;
  expiresAt: string | null;
  rejectReason: string | null;
  account: { bankName: string; accountName: string; accountNumber: string } | null;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const remaining = useCountdown(expiresAt);

  // สร้าง QR ฝั่งเบราว์เซอร์ จาก payload (เลี่ยงปัญหา serverless บน Vercel)
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);
  useEffect(() => {
    let active = true;
    if (!qrPayload) {
      setQrDataUrl(null);
      return;
    }
    import("qrcode")
      .then((mod) =>
        mod.default.toDataURL(qrPayload, {
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
  }, [qrPayload]);

  const isVerified = status === "VERIFIED";
  const isCancelled = orderStatus === "CANCELLED";
  const isExpired =
    !isVerified &&
    !isCancelled &&
    status !== "SUBMITTED" &&
    expiresAt !== null &&
    remaining <= 0;
  // QR ใช้ไม่ได้แล้ว (หมดอายุ หรือ ออเดอร์ถูกยกเลิก) → เบลอทิ้ง
  const isUnusable = isExpired || isCancelled;
  const mm = Math.floor(remaining / 60000);
  const ss = Math.floor((remaining % 60000) / 1000);

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
    <Card className="lg:sticky lg:top-20">
      <CardHeader className="flex-row items-center justify-between">
        <CardTitle className="flex items-center gap-2 text-base">
          <QrCode className="h-4 w-4" /> ชำระเงิน
        </CardTitle>
        <Badge variant="outline" className={cn("text-xs", paymentStatusColor[status])}>
          {paymentStatusLabel[status]}
        </Badge>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="text-center">
          <div className="text-xs text-muted-foreground">ยอดที่ต้องชำระ</div>
          <div className="text-3xl font-bold text-primary">{formatBaht(amount)}</div>
        </div>

        {isVerified ? (
          <div className="flex flex-col items-center gap-2 rounded-lg bg-emerald-50 p-6 text-center dark:bg-emerald-950/40">
            <CheckCircle2 className="h-12 w-12 text-emerald-600" />
            <div className="font-medium text-emerald-700 dark:text-emerald-400">
              ชำระเงินเรียบร้อยแล้ว
            </div>
          </div>
        ) : (
          <>
            {/* QR */}
            <div className="relative mx-auto w-fit">
              {qrDataUrl ? (
                <div
                  className={cn(
                    "rounded-xl border bg-white p-3 transition",
                    isUnusable && "opacity-30 blur-[2px]"
                  )}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={qrDataUrl}
                    alt="PromptPay QR"
                    width={220}
                    height={220}
                    className="mx-auto"
                  />
                </div>
              ) : (
                <div className="flex h-[246px] w-[246px] items-center justify-center rounded-xl border bg-muted text-center text-sm text-muted-foreground">
                  ยังไม่มี QR<br />(ตั้งค่าบัญชี PromptPay ก่อน)
                </div>
              )}
              {isUnusable && (
                <div className="absolute inset-0 flex flex-col items-center justify-center gap-1 text-center">
                  {isCancelled ? (
                    <>
                      <XCircle className="h-8 w-8 text-rose-500" />
                      <span className="font-medium">ออเดอร์ถูกยกเลิก</span>
                    </>
                  ) : (
                    <>
                      <Clock className="h-8 w-8 text-muted-foreground" />
                      <span className="font-medium">QR หมดอายุ</span>
                    </>
                  )}
                </div>
              )}
            </div>

            {/* Countdown */}
            {!isUnusable && expiresAt && status !== "SUBMITTED" && (
              <div className="flex items-center justify-center gap-1.5 text-sm">
                <Clock className="h-4 w-4 text-amber-600" />
                <span className="text-muted-foreground">เหลือเวลา</span>
                <span className="font-mono font-semibold tabular-nums">
                  {String(mm).padStart(2, "0")}:{String(ss).padStart(2, "0")}
                </span>
              </div>
            )}

            {account && (
              <div className="rounded-lg bg-muted/40 p-3 text-center text-xs text-muted-foreground">
                {account.bankName} · {account.accountName}
                <br />
                {account.accountNumber}
              </div>
            )}

            {!isCancelled && (
              <Button
                variant="outline"
                className="w-full"
                onClick={() => run(() => regeneratePayment(orderId))}
                disabled={isPending}
              >
                {isPending ? <Loader2 className="animate-spin" /> : <RefreshCw />}
                สร้าง QR ใหม่ (15 นาที)
              </Button>
            )}
          </>
        )}

        {rejectReason && status === "REJECTED" && (
          <div className="rounded-lg bg-rose-50 p-3 text-center text-xs text-rose-700 dark:bg-rose-950/40 dark:text-rose-400">
            ถูกปฏิเสธ: {rejectReason}
          </div>
        )}

        {/* Admin actions */}
        {!isVerified && orderStatus === "PENDING_PAYMENT" && (
          <div className="space-y-2 border-t pt-3">
            <div className="text-xs font-medium text-muted-foreground">
              การตรวจสอบ (แอดมิน)
            </div>
            {status === "PENDING" && (
              <Button
                variant="secondary"
                className="w-full"
                onClick={() => run(() => markSlipSubmitted(orderId))}
                disabled={isPending}
              >
                <Upload /> ลูกค้าแจ้งชำระ / อัปโหลดสลิปแล้ว
              </Button>
            )}
            <div className="grid grid-cols-2 gap-2">
              <Button
                className="bg-emerald-600 hover:bg-emerald-700"
                onClick={() => run(() => verifyPayment(orderId))}
                disabled={isPending}
              >
                <CheckCircle2 /> ยืนยัน
              </Button>
              <Button
                variant="destructive"
                onClick={() =>
                  run(() => rejectPayment(orderId, "ยอดไม่ตรง / สลิปไม่ถูกต้อง"))
                }
                disabled={isPending}
              >
                <XCircle /> ปฏิเสธ
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
