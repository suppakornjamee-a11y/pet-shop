import { Badge } from "@/components/ui/badge";
import { PendingReviewIcon, PendingReviewMark } from "@/components/pending-review-icon";
import { cn } from "@/lib/utils";
import { orderStatusColor, paymentStatusColor } from "@/lib/labels";
import type { StatusBadgeInfo } from "@/lib/order-kind";
import type { Dictionary } from "@/i18n/dictionaries/th";

/** แสดง badge สถานะออเดอร์แบบ personalize ตามผลจาก getStatusBadgeInfo — ใช้ร่วมกันทุกหน้าที่โชว์สถานะออเดอร์ */
export function OrderStatusBadges({
  info,
  t,
  size = "sm",
}: {
  info: StatusBadgeInfo;
  t: Dictionary;
  size?: "sm" | "xs";
}) {
  const textSize = size === "sm" ? "text-xs" : "text-[10px]";

  if (info.kind === "SHOP_PAID") {
    return (
      <Badge variant="outline" className={cn(textSize, orderStatusColor.PAID)}>
        {t.orders.shopPaidBadge}
      </Badge>
    );
  }

  if (info.kind === "SLIP_SUBMITTED") {
    return (
      <Badge variant="outline" className={cn(textSize, "gap-1", paymentStatusColor.SUBMITTED)}>
        <PendingReviewIcon className="h-3.5 w-3.5" />
        {t.orders.slipPendingReviewBadge}
      </Badge>
    );
  }

  if (info.kind === "BATHING_IN_PROGRESS") {
    return (
      <Badge variant="outline" className={cn(textSize, orderStatusColor.IN_PROGRESS)}>
        {t.orders.bathingInProgressBadge}
      </Badge>
    );
  }

  if (info.kind === "GROOMER_FINISHED") {
    return (
      <Badge variant="outline" className={cn(textSize, orderStatusColor.COMPLETED)}>
        {t.orders.myWorkDoneBadge}
      </Badge>
    );
  }

  if (info.kind === "AWAITING_PAYMENT") {
    return (
      <div className="flex items-center gap-1.5">
        <Badge variant="outline" className={cn(textSize, orderStatusColor.COMPLETED)}>
          {t.orders.workDoneBadge}
        </Badge>
        <Badge variant="outline" className={cn("text-[10px]", orderStatusColor.CANCELLED)}>
          {t.orders.awaitingPaymentTag}
        </Badge>
      </div>
    );
  }

  if (info.status === "PENDING_APPROVAL") {
    return <PendingReviewMark size={size}>{t.orders.pendingReview}</PendingReviewMark>;
  }

  return (
    <Badge variant="outline" className={cn(textSize, orderStatusColor[info.status])}>
      {t.labels.orderStatus[info.status]}
    </Badge>
  );
}
