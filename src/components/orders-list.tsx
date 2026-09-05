import Link from "next/link";
import { ReceiptText } from "lucide-react";
import { prisma } from "@/lib/prisma";
import type { OrderStatus } from "@/generated/prisma/enums";
import { requireUser } from "@/lib/auth-helpers";
import { formatBaht, formatDateTime } from "@/lib/format";
import { getStatusBadgeInfo } from "@/lib/order-kind";
import { thaiDayRange, todayThaiStr, isValidDateStr } from "@/lib/slots";
import { PageHeader } from "@/components/page-header";
import { SpeciesIcon } from "@/components/species-icon";
import { OrderStatusBadges } from "@/components/order-status-badges";
import { DateFilter } from "@/components/date-filter";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { getDictionary } from "@/i18n/get-dictionary";
import { getLocale } from "@/i18n/get-locale";

export async function OrdersList({
  queueType,
  basePath,
  status,
  date,
}: {
  queueType: "BATH" | "OTHER";
  basePath: string;
  status: string;
  /** วันที่ที่เลือก (YYYY-MM-DD) — ไม่ส่งมา = วันนี้ */
  date?: string;
}) {
  const user = await requireUser();
  const t = getDictionary(await getLocale());

  const filters: { label: string; value: string }[] = [
    { label: t.orders.filterAll, value: "all" },
    { label: t.orders.filterPending, value: "PENDING_PAYMENT" },
    { label: t.orders.filterPaid, value: "PAID" },
    { label: t.orders.filterInProgress, value: "IN_PROGRESS" },
    { label: t.orders.filterCompleted, value: "COMPLETED" },
    { label: t.orders.filterCancelled, value: "CANCELLED" },
  ];

  // ครั้งแรกที่เข้าหน้านี้ให้ดึงเฉพาะของวันนี้ก่อน
  const selectedDate = date && isValidDateStr(date) ? date : todayThaiStr();
  const { start, end } = thaiDayRange(selectedDate);

  const queueWhere =
    queueType === "BATH"
      ? { OR: [{ queueType: "BATH" as const }, { queueType: null }] }
      : { queueType: "OTHER" as const };

  const orders = await prisma.order.findMany({
    where: {
      appointmentAt: { not: null },
      createdAt: { gte: start, lt: end },
      ...queueWhere,
      ...(status !== "all" ? { status: status as OrderStatus } : {}),
    },
    include: {
      customer: true,
      pet: true,
      payments: { select: { status: true, amount: true } },
      extraCharges: { select: { amount: true } },
      activityLogs: { select: { action: true, createdById: true } },
    },
    orderBy: { createdAt: "desc" },
    take: 100,
  });

  const title = queueType === "BATH" ? t.orders.titleBath : t.orders.titleOther;

  return (
    <div>
      <PageHeader
        title={title}
        description={t.orders.description}
        action={
          <DateFilter
            value={selectedDate}
            basePath={basePath}
            keepParams={{ status: status !== "all" ? status : undefined }}
          />
        }
      />

      <div className="mb-4 flex flex-wrap gap-2">
        {filters.map((f) => (
          <Button
            key={f.value}
            render={
              <Link
                href={`${basePath}?${new URLSearchParams({
                  ...(f.value !== "all" ? { status: f.value } : {}),
                  date: selectedDate,
                }).toString()}`}
              />
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
              {t.orders.empty}
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
                      <OrderStatusBadges info={getStatusBadgeInfo(o, user)} t={t} size="xs" />
                    </div>
                    <div className="flex items-center gap-1 truncate text-xs text-muted-foreground">
                      {o.pet && <SpeciesIcon species={o.pet.species} className="h-3.5 w-3.5 shrink-0" />}
                      <span className="truncate">{o.customer.name}</span>
                    </div>
                    <div className="truncate text-xs text-muted-foreground">
                      {t.orders.transactionDate}: {formatDateTime(o.createdAt)}
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
