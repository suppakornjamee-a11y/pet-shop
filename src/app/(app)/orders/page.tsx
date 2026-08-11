import Link from "next/link";
import { ClipboardPlus, ReceiptText } from "lucide-react";
import { prisma } from "@/lib/prisma";
import type { OrderStatus } from "@/generated/prisma/enums";
import { formatBaht, formatDateTime } from "@/lib/format";
import { orderStatusLabel, orderStatusColor, speciesEmoji } from "@/lib/labels";
import { cn } from "@/lib/utils";
import { PageHeader } from "@/components/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

const filters: { label: string; value: string }[] = [
  { label: "ทั้งหมด", value: "all" },
  { label: "รอชำระเงิน", value: "PENDING_PAYMENT" },
  { label: "ชำระแล้ว", value: "PAID" },
  { label: "กำลังดำเนินการ", value: "IN_PROGRESS" },
  { label: "เสร็จสิ้น", value: "COMPLETED" },
  { label: "ยกเลิก", value: "CANCELLED" },
];

export default async function OrdersPage(props: PageProps<"/orders">) {
  const searchParams = await props.searchParams;
  const status = typeof searchParams.status === "string" ? searchParams.status : "all";

  const where =
    status !== "all" ? { status: status as OrderStatus } : {};

  const orders = await prisma.order.findMany({
    where,
    include: { customer: true, pet: true },
    orderBy: { createdAt: "desc" },
    take: 100,
  });

  return (
    <div>
      <PageHeader
        title="ออเดอร์ทั้งหมด"
        description="รายการออเดอร์ล่าสุด"
        action={
          <Button render={<Link href="/orders/new" />} nativeButton={false}>
            <ClipboardPlus /> สร้างออเดอร์
          </Button>
        }
      />

      <div className="mb-4 flex flex-wrap gap-2">
        {filters.map((f) => (
          <Button
            key={f.value}
            render={
              <Link href={f.value === "all" ? "/orders" : `/orders?status=${f.value}`} />
            }
            nativeButton={false}
            size="sm"
            variant={status === f.value ? "default" : "outline"}
          >
            {f.label}
          </Button>
        ))}
      </div>

      <Card>
        <CardContent className="p-0">
          {orders.length === 0 ? (
            <div className="flex flex-col items-center gap-2 py-16 text-center text-muted-foreground">
              <ReceiptText className="h-10 w-10 opacity-40" />
              ไม่มีออเดอร์ในหมวดนี้
            </div>
          ) : (
            <div className="divide-y">
              {orders.map((o) => (
                <Link
                  key={o.id}
                  href={`/orders/${o.id}`}
                  className="flex items-center justify-between gap-3 p-4 transition-colors hover:bg-accent/50"
                >
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-medium">{o.code}</span>
                      <Badge
                        variant="outline"
                        className={cn("text-[10px]", orderStatusColor[o.status])}
                      >
                        {orderStatusLabel[o.status]}
                      </Badge>
                    </div>
                    <div className="truncate text-xs text-muted-foreground">
                      {o.pet ? speciesEmoji[o.pet.species] : ""} {o.customer.name} ·{" "}
                      {o.customer.phone} · {formatDateTime(o.createdAt)}
                    </div>
                  </div>
                  <div className="shrink-0 font-semibold">{formatBaht(o.total)}</div>
                </Link>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
