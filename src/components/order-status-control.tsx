"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Loader2, PlayCircle, CheckCircle2, Ban } from "lucide-react";
import { updateOrderStatus, markGroomerFinished } from "@/app/actions/orders";
import type { OrderStatus, Role } from "@/generated/prisma/enums";
import { canStartOrder, canCheckoutOrder, type OrderKind, type StatusBadgeInfo } from "@/lib/order-kind";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { useI18n } from "@/components/i18n-provider";

export function OrderStatusControl({
  orderId,
  status,
  role,
  orderKind,
  isFullyPaid,
  roomLabel,
  iHaveStartedNotFinished,
  badgeInfo,
}: {
  orderId: string;
  status: OrderStatus;
  role: Role;
  orderKind: OrderKind;
  isFullyPaid: boolean;
  roomLabel: string | null;
  iHaveStartedNotFinished: boolean;
  badgeInfo: StatusBadgeInfo;
}) {
  const { t } = useI18n();
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [cctvOpen, setCctvOpen] = useState(false);

  function change(next: OrderStatus) {
    startTransition(async () => {
      const res = await updateOrderStatus(orderId, next);
      if (!res.ok) toast.error(res.error);
      else {
        toast.success(res.message);
        if (res.cctvReminder) setCctvOpen(true);
        router.refresh();
      }
    });
  }

  function finishMyWork() {
    startTransition(async () => {
      const res = await markGroomerFinished(orderId);
      if (!res.ok) toast.error(res.error);
      else {
        toast.success(res.message);
        router.refresh();
      }
    });
  }

  if (status === "COMPLETED" || status === "CANCELLED") {
    return null;
  }

  const canStart = canStartOrder(orderKind, role);
  const canCheckout = canCheckoutOrder(orderKind, role);

  const isGroomerBath = orderKind === "BATH" && role === "GROOMER";

  // งานอาบน้ำ: ปุ่มเริ่มดำเนินการของ "ช่าง" ยังอยู่แม้สถานะเป็น IN_PROGRESS แล้ว เพื่อให้ช่างคนอื่นกดเพิ่ม log ได้อีก
  // แต่ถ้าช่างคนนี้กดเริ่มไปแล้วและยังไม่ได้กด "ทำรายการเสร็จสิ้น" ปุ่มนี้จะสลับเป็นปุ่มนั้นแทน (ดูด้านล่าง)
  const showStart =
    canStart &&
    (isGroomerBath
      ? (status === "PAID" || status === "DEPOSIT_PAID" || status === "IN_PROGRESS") && !iHaveStartedNotFinished
      : status === "PAID" || status === "DEPOSIT_PAID");
  const showFinishMyWork = isGroomerBath && status === "IN_PROGRESS" && iHaveStartedNotFinished;
  const showCheckout = canCheckout && status === "IN_PROGRESS";
  // badgeInfo มาจาก getStatusBadgeInfo ตัวเดียวกับที่ตัดสินใจ badge — เลยล็อกให้ปุ่มตรงกับ badge เสมอ
  const hideActionsForFinishedGroomer = badgeInfo.kind === "GROOMER_FINISHED";
  const checkoutBlocked = badgeInfo.kind === "AWAITING_PAYMENT";

  const startBlocked = showStart && orderKind === "BOARDING" && !isFullyPaid;

  return (
    <>
      {!hideActionsForFinishedGroomer && (
        <div className="flex flex-wrap items-start justify-end gap-2">
          {showStart && (
            <div>
              <Button onClick={() => change("IN_PROGRESS")} disabled={isPending || startBlocked}>
                {isPending ? <Loader2 className="animate-spin" /> : <PlayCircle />}
                {t.orders.startWork}
              </Button>
              {startBlocked && (
                <p className="mt-1 text-xs text-muted-foreground">{t.orders.startBlockedNotFullyPaid}</p>
              )}
            </div>
          )}
          {showFinishMyWork && (
            <Button
              className="bg-sky-600 hover:bg-sky-700"
              onClick={finishMyWork}
              disabled={isPending}
            >
              {isPending ? <Loader2 className="animate-spin" /> : <CheckCircle2 />}
              {t.orders.finishMyWork}
            </Button>
          )}
          {showCheckout && (
            <Button
              className="bg-emerald-600 hover:bg-emerald-700"
              onClick={() => change("COMPLETED")}
              disabled={isPending || checkoutBlocked}
            >
              {isPending ? <Loader2 className="animate-spin" /> : <CheckCircle2 />}
              {t.orders.finishWork}
            </Button>
          )}
          <Button variant="outline" onClick={() => change("CANCELLED")} disabled={isPending}>
            <Ban /> {t.orders.cancelOrder}
          </Button>
        </div>
      )}

      <Dialog open={cctvOpen} onOpenChange={setCctvOpen}>
        <DialogContent showCloseButton={false}>
          <DialogHeader>
            <DialogTitle>{t.orders.cctvReminderTitle}</DialogTitle>
            <DialogDescription>{t.orders.cctvReminderDescription(roomLabel ?? "-")}</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button onClick={() => setCctvOpen(false)}>{t.orders.cctvReminderAck}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
