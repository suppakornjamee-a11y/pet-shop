"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Loader2, XCircle, ReceiptText } from "lucide-react";
import { liffListOrders } from "@/app/actions/liff";
import { formatBaht, formatDate } from "@/lib/format";
import { orderStatusColor, paymentStatusColor } from "@/lib/labels";
import { cn } from "@/lib/utils";
import { useLiff, LiffGate, handleLiffAuthExpiry } from "@/components/liff-provider";
import { useI18n } from "@/components/i18n-provider";
import { PageHeader } from "@/components/page-header";
import { Badge } from "@/components/ui/badge";
import type { OrderStatus } from "@/generated/prisma/enums";

type OrderRow = {
  id: string;
  code: string;
  createdAt: string;
  status: OrderStatus;
  petName: string | null;
  total: number;
  remainingAmount: number;
  hasSubmittedSlip: boolean;
};

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

  return (
    <div className="space-y-5">
      <PageHeader title={t.liff.ordersPageTitle} />

      {orders.length === 0 ? (
        <div className="flex flex-col items-center gap-2 rounded-lg border border-dashed p-10 text-center">
          <ReceiptText className="h-10 w-10 text-muted-foreground/40" />
          <p className="font-medium">{t.liff.ordersEmptyTitle}</p>
          <p className="text-sm text-muted-foreground">{t.liff.ordersEmptyHint}</p>
        </div>
      ) : (
        <div className="space-y-2">
          {orders.map((o) => {
            const isCancelled = o.status === "CANCELLED";
            const owesMore = !isCancelled && o.remainingAmount > 0;
            return (
              <Link
                key={o.id}
                href={`/liff/pay/${o.id}`}
                className="flex items-center justify-between gap-3 rounded-lg border p-3 transition-colors hover:bg-accent/50"
              >
                <div className="min-w-0">
                  <div className="font-medium">{o.code}</div>
                  <div className="mt-1">
                    {o.hasSubmittedSlip && !isCancelled ? (
                      <Badge variant="outline" className={cn("text-[10px]", paymentStatusColor.SUBMITTED)}>
                        {t.orders.slipPendingReviewBadge}
                      </Badge>
                    ) : (
                      <Badge variant="outline" className={cn("text-[10px]", orderStatusColor[o.status])}>
                        {t.labels.orderStatus[o.status]}
                      </Badge>
                    )}
                  </div>
                  <div className="mt-1 truncate text-xs text-muted-foreground">
                    {o.petName ? `${o.petName} · ` : ""}
                    {formatDate(o.createdAt)}
                  </div>
                </div>
                <div className="shrink-0 text-right">
                  <div className="font-semibold">{formatBaht(o.total)}</div>
                  {owesMore ? (
                    <div className="text-xs font-semibold text-red-600 dark:text-red-400">
                      {t.liff.remainingBadge(formatBaht(o.remainingAmount))}
                    </div>
                  ) : (
                    !isCancelled && (
                      <div className="text-xs text-emerald-600 dark:text-emerald-400">{t.liff.fullyPaidBadge}</div>
                    )
                  )}
                </div>
              </Link>
            );
          })}
        </div>
      )}
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
