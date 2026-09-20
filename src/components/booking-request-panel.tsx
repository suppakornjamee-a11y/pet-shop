"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Ban, CalendarClock, Loader2 } from "lucide-react";
import { cancelBookingRequest } from "@/app/actions/booking-requests";
import { formatBaht } from "@/lib/format";
import { cn } from "@/lib/utils";
import { notifyStaffAlertsChanged } from "@/lib/staff-alerts-signal";
import { useI18n } from "@/components/i18n-provider";
import { SpeciesIcon } from "@/components/species-icon";
import { SealLabel } from "@/components/verify-seal";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";

type OrderStatus =
  | "PENDING_APPROVAL"
  | "RESCHEDULE_REQUIRED"
  | "PENDING_PAYMENT"
  | "DEPOSIT_PAID"
  | "PAID"
  | "IN_PROGRESS"
  | "COMPLETED"
  | "CANCELLED";

type RequestStatus =
  | "PENDING_APPROVAL"
  | "NEEDS_RESCHEDULE"
  | "PENDING_DEPOSIT"
  | "DEPOSIT_SUBMITTED"
  | "CONFIRMED"
  | "CANCELLED";

export type BookingRequestView = {
  id: string;
  code: string;
  status: RequestStatus;
  rescheduleReason: string | null;
  totalEstimate: number;
  dueNow: number;
  items: {
    orderId: string;
    orderCode: string;
    isCurrent: boolean;
    petName: string | null;
    species: "DOG" | "CAT" | null;
    summary: string;
    when: string;
    total: number;
    dueNow: number;
    cancelled: boolean;
    status: OrderStatus;
  }[];
};

const TONE: Record<RequestStatus, string> = {
  PENDING_APPROVAL: "bg-violet-100 text-violet-800 dark:bg-violet-950 dark:text-violet-300",
  NEEDS_RESCHEDULE: "bg-fuchsia-100 text-fuchsia-800 dark:bg-fuchsia-950 dark:text-fuchsia-300",
  PENDING_DEPOSIT: "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300",
  DEPOSIT_SUBMITTED: "bg-sky-100 text-sky-800 dark:bg-sky-950 dark:text-sky-300",
  CONFIRMED: "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300",
  CANCELLED: "bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300",
};

/**
 * กล่องคำขอจองบนหน้าออเดอร์ — แสดงทุกรายการในคำขอ (ทุกตัว ทุกบริการ) พร้อมสถานะของแต่ละรายการ
 * อนุมัติคิว / คิวไม่ว่าง ทำทีละรายการด้วยปุ่มเดิมของออเดอร์ กล่องนี้มีแค่ยกเลิกทั้งคำขอ
 * ช่างอาบน้ำไม่เห็นปุ่ม (เซิร์ฟเวอร์ก็กันไว้แล้ว)
 */
export function BookingRequestPanel({ request, canManage }: { request: BookingRequestView; canManage: boolean }) {
  const { t } = useI18n();
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [dialog, setDialog] = useState<"cancel" | null>(null);
  const [reason, setReason] = useState("");

  function run(fn: () => Promise<{ ok: boolean; error?: string; message?: string }>) {
    startTransition(async () => {
      const res = await fn();
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      toast.success(res.message);
      setDialog(null);
      setReason("");
      router.refresh();
      notifyStaffAlertsChanged();
    });
  }

  return (
    <Card>
      <CardHeader className="flex flex-wrap items-start justify-between gap-2">
        <div className="space-y-1">
          <CardTitle className="flex flex-wrap items-center gap-2 text-base">
            {t.bookingRequest.title} {request.code}
            {request.status === "PENDING_APPROVAL" ? (
              <SealLabel passed={false}>{t.orders.pendingReview}</SealLabel>
            ) : (
              <span className={cn("rounded-full px-2 py-0.5 text-xs font-medium", TONE[request.status])}>
                {t.labels.bookingRequestStatus[request.status]}
              </span>
            )}
          </CardTitle>
          {request.status === "NEEDS_RESCHEDULE" && request.rescheduleReason && (
            <p className="text-sm text-fuchsia-700 dark:text-fuchsia-300">
              {t.bookingRequest.reasonLabel}: {request.rescheduleReason}
            </p>
          )}
        </div>
        {canManage && (
          <div className="flex flex-wrap gap-2">
            {request.status !== "CANCELLED" && request.status !== "CONFIRMED" && (
              <Button variant="ghost" size="sm" disabled={isPending} onClick={() => setDialog("cancel")}>
                <Ban /> {t.bookingRequest.cancel}
              </Button>
            )}
          </div>
        )}
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="divide-y rounded-lg border">
          {request.items.map((it) => (
            <Link
              key={it.orderId}
              href={`/orders/${it.orderId}`}
              className={cn(
                "flex items-start justify-between gap-3 px-3 py-2.5 text-sm transition-colors hover:bg-accent/50",
                it.isCurrent && "bg-primary/5",
                it.cancelled && "opacity-50"
              )}
            >
              <div className="min-w-0 space-y-0.5">
                <div className="flex items-center gap-1.5 font-medium">
                  {it.species && <SpeciesIcon species={it.species} className="h-4 w-4" />}
                  {it.petName ?? "-"}
                  <span className="font-normal text-muted-foreground">· {it.orderCode}</span>
                  <span className="rounded-full bg-muted px-2 py-0.5 text-[0.6875rem] font-normal">
                    {t.labels.orderStatus[it.status]}
                  </span>
                </div>
                <div className="truncate text-xs text-muted-foreground">{it.summary}</div>
                <div className="flex items-center gap-1 text-xs">
                  <CalendarClock className="h-3.5 w-3.5 text-muted-foreground" />
                  {it.when}
                </div>
              </div>
              <div className="shrink-0 text-right text-xs">
                <div className="font-semibold">{formatBaht(it.total)}</div>
                <div className="text-muted-foreground">
                  {t.bookingRequest.dueNowLabel} {formatBaht(it.dueNow)}
                </div>
              </div>
            </Link>
          ))}
        </div>
        <div className="space-y-0.5">
          <div className="flex items-baseline justify-between text-xs">
            <span className="text-muted-foreground">{t.bookingRequest.dueNowTotal}</span>
            <span className="font-bold">{formatBaht(request.dueNow)}</span>
          </div>
          <div className="flex items-baseline justify-between">
            <span className="text-sm text-muted-foreground">{t.bookingRequest.totalEstimate}</span>
            <span className="text-xl font-bold text-red-600 dark:text-red-400">{formatBaht(request.totalEstimate)}</span>
          </div>
        </div>
      </CardContent>

      <Dialog open={dialog !== null} onOpenChange={(o) => !o && setDialog(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t.bookingRequest.cancel}</DialogTitle>
          </DialogHeader>
          <div className="space-y-1.5">
            <Label htmlFor="br-reason" className="text-xs">
              {t.bookingRequest.reasonLabel}
            </Label>
            <Textarea id="br-reason" rows={3} value={reason} onChange={(e) => setReason(e.target.value)} autoFocus />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialog(null)} disabled={isPending}>
              {t.common.cancel}
            </Button>
            <Button
              variant="destructive"
              disabled={isPending || !reason.trim()}
              onClick={() => run(() => cancelBookingRequest(request.id, reason))}
            >
              {isPending && <Loader2 className="animate-spin" />}
              {t.common.confirm}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
