"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Loader2, PlayCircle, CheckCircle2, Ban, CalendarCheck } from "lucide-react";
import {
  updateOrderStatus,
  markGroomerFinished,
  approveOrderQueue,
  rejectOrderQueue,
} from "@/app/actions/orders";
import type { OrderStatus, Role } from "@/generated/prisma/enums";
import { canStartOrder, canCheckoutOrder, type OrderKind, type StatusBadgeInfo } from "@/lib/order-kind";
import { Button } from "@/components/ui/button";
import { ConfirmButton } from "@/components/ui/confirm-button";
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
  isShopOrder = false,
}: {
  orderId: string;
  status: OrderStatus;
  role: Role;
  orderKind: OrderKind;
  isFullyPaid: boolean;
  roomLabel: string | null;
  iHaveStartedNotFinished: boolean;
  badgeInfo: StatusBadgeInfo;
  /** บิลร้านอาหารไม่มีขั้นตอนดำเนินการ/เช็คเอ้าท์ — เหลือแค่ยกเลิกบิล */
  isShopOrder?: boolean;
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

  function approveQueue() {
    startTransition(async () => {
      const res = await approveOrderQueue(orderId);
      if (!res.ok) toast.error(res.error);
      else {
        toast.success(res.message);
        router.refresh();
      }
    });
  }

  function rejectQueue() {
    startTransition(async () => {
      const res = await rejectOrderQueue(orderId, "");
      if (!res.ok) toast.error(res.error);
      else {
        toast.success(res.message);
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

  // รอเช็คคิว = ยังไม่ผ่านการยืนยัน ห้ามข้ามไปเริ่มงาน/เช็คเอ้าท์ ต้องกดยืนยันคิวก่อนเท่านั้น
  const awaitingApproval = status === "PENDING_APPROVAL";

  const canStart = canStartOrder(orderKind, role);
  const canCheckout = canCheckoutOrder(orderKind, role);

  const isGroomerBath = orderKind === "BATH" && role === "GROOMER";

  // งานอาบน้ำ: ปุ่มเริ่มดำเนินการของ "ช่าง" ยังอยู่แม้สถานะเป็น IN_PROGRESS แล้ว เพื่อให้ช่างคนอื่นกดเพิ่ม log ได้อีก
  // แต่ถ้าช่างคนนี้กดเริ่มไปแล้วและยังไม่ได้กด "ทำรายการเสร็จสิ้น" ปุ่มนี้จะสลับเป็นปุ่มนั้นแทน (ดูด้านล่าง)
  const showStart =
    !awaitingApproval &&
    !isShopOrder &&
    canStart &&
    (isGroomerBath
      ? (status === "PAID" || status === "DEPOSIT_PAID" || status === "IN_PROGRESS") && !iHaveStartedNotFinished
      : status === "PAID" || status === "DEPOSIT_PAID");
  const showFinishMyWork = isGroomerBath && status === "IN_PROGRESS" && iHaveStartedNotFinished;
  const showCheckout = !awaitingApproval && !isShopOrder && canCheckout && status === "IN_PROGRESS";
  // badgeInfo มาจาก getStatusBadgeInfo ตัวเดียวกับที่ตัดสินใจ badge — เลยล็อกให้ปุ่มตรงกับ badge เสมอ
  const hideActionsForFinishedGroomer = badgeInfo.kind === "GROOMER_FINISHED";
  const checkoutBlocked = badgeInfo.kind === "AWAITING_PAYMENT";

  const startBlocked = showStart && orderKind === "BOARDING" && !isFullyPaid;

  return (
    <>
      {!hideActionsForFinishedGroomer && (
        <div className="flex flex-wrap items-start justify-end gap-2">
          {/* ลูกค้าจองเองผ่าน LINE — ต้องกดยืนยันคิวก่อน ลูกค้าถึงจะเข้าหน้าชำระเงินได้ */}
          {awaitingApproval && role !== "GROOMER" && (
            <>
              <ConfirmButton
                variant="outline"
                tone="danger"
                title={t.orders.confirmRejectQueueTitle}
                description={t.orders.confirmRejectQueueDescription}
                confirmLabel={t.orders.rejectQueue}
                onConfirm={rejectQueue}
                disabled={isPending}
              >
                <Ban /> {t.orders.rejectQueue}
              </ConfirmButton>
              <ConfirmButton
                title={t.orders.confirmApproveQueueTitle}
                description={t.orders.confirmApproveQueueDescription}
                confirmLabel={t.orders.approveQueue}
                onConfirm={approveQueue}
                disabled={isPending}
              >
                {isPending ? <Loader2 className="animate-spin" /> : <CalendarCheck />}
                {t.orders.approveQueue}
              </ConfirmButton>
            </>
          )}
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
            <ConfirmButton
              className="bg-emerald-600 hover:bg-emerald-700"
              title={t.orders.confirmFinishTitle}
              description={t.orders.confirmFinishDescription}
              confirmLabel={t.orders.finishWork}
              onConfirm={() => change("COMPLETED")}
              disabled={isPending || checkoutBlocked}
            >
              {isPending ? <Loader2 className="animate-spin" /> : <CheckCircle2 />}
              {t.orders.finishWork}
            </ConfirmButton>
          )}
          {!awaitingApproval && (
          <ConfirmButton
            variant="outline"
            tone="danger"
            title={t.orders.confirmCancelTitle}
            description={t.orders.confirmCancelDescription}
            confirmLabel={t.orders.cancelOrder}
            onConfirm={() => change("CANCELLED")}
            disabled={isPending}
          >
            <Ban /> {t.orders.cancelOrder}
          </ConfirmButton>
          )}
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
