"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Loader2, PlayCircle, CheckCircle2, Ban } from "lucide-react";
import { updateOrderStatus } from "@/app/actions/orders";
import type { OrderStatus } from "@/generated/prisma/enums";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

export function OrderStatusControl({
  orderId,
  status,
}: {
  orderId: string;
  status: OrderStatus;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  function change(next: OrderStatus) {
    startTransition(async () => {
      const res = await updateOrderStatus(orderId, next);
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

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">จัดการสถานะงาน</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-wrap gap-2">
        {(status === "PAID" || status === "DEPOSIT_PAID") && (
          <Button onClick={() => change("IN_PROGRESS")} disabled={isPending}>
            {isPending ? <Loader2 className="animate-spin" /> : <PlayCircle />}
            เริ่มดำเนินการ
          </Button>
        )}
        {status === "IN_PROGRESS" && (
          <Button
            className="bg-emerald-600 hover:bg-emerald-700"
            onClick={() => change("COMPLETED")}
            disabled={isPending}
          >
            {isPending ? <Loader2 className="animate-spin" /> : <CheckCircle2 />}
            เสร็จสิ้นงาน
          </Button>
        )}
        <Button variant="outline" onClick={() => change("CANCELLED")} disabled={isPending}>
          <Ban /> ยกเลิกออเดอร์
        </Button>
      </CardContent>
    </Card>
  );
}
