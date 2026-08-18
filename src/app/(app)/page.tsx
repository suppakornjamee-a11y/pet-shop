import Link from "next/link";
import {
  ClipboardPlus,
  PawPrint,
  Wallet,
  // ReceiptText,
  // Clock,
  // TrendingUp,
  LogIn,
  LogOut,
  Bath,
} from "lucide-react";
import { prisma } from "@/lib/prisma";
import { formatDate, formatBaht, formatDateTime } from "@/lib/format";
import { orderStatusColor } from "@/lib/labels";
import { getLocale } from "@/i18n/get-locale";
import { getDictionary } from "@/i18n/get-dictionary";
import { PageHeader } from "@/components/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { DashboardDatePicker } from "@/components/dashboard-date-picker";
import { cn } from "@/lib/utils";

function parseDate(input?: string) {
  if (input && /^\d{4}-\d{2}-\d{2}$/.test(input)) {
    const [y, m, d] = input.split("-").map(Number);
    const start = new Date(y, m - 1, d);
    if (!isNaN(start.getTime())) return start;
  }
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), now.getDate());
}

function toDateStr(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(
    d.getDate()
  ).padStart(2, "0")}`;
}

export default async function DashboardPage(props: PageProps<"/">) {
  const t = getDictionary(await getLocale());
  const searchParams = await props.searchParams;
  const dateParam = typeof searchParams.date === "string" ? searchParams.date : undefined;
  const startOfDay = parseDate(dateParam);
  const endOfDay = new Date(
    startOfDay.getFullYear(),
    startOfDay.getMonth(),
    startOfDay.getDate() + 1
  );
  const selectedDateStr = toDateStr(startOfDay);
  const isToday = selectedDateStr === toDateStr(new Date());

  const [
    // dayOrders,
    // paidDay,
    // pendingPayments,
    // customerCount,
    dayOrderList,
    checkInsToday,
    checkOutsToday,
    groomingQueueToday,
  ] = await Promise.all([
    // prisma.order.count({ where: { createdAt: { gte: startOfDay, lt: endOfDay } } }),
    // prisma.order.aggregate({
    //   _sum: { total: true },
    //   where: {
    //     createdAt: { gte: startOfDay, lt: endOfDay },
    //     status: { in: ["PAID", "IN_PROGRESS", "COMPLETED"] },
    //   },
    // }),
    // prisma.order.count({ where: { status: "PENDING_PAYMENT" } }),
    // prisma.customer.count(),
    prisma.order.findMany({
      where: { createdAt: { gte: startOfDay, lt: endOfDay } },
      take: 10,
      orderBy: { createdAt: "desc" },
      include: {
        customer: true,
        pet: true,
        payments: { where: { status: "VERIFIED" }, select: { amount: true } },
      },
    }),
    prisma.order.count({
      where: { checkInAt: { gte: startOfDay, lt: endOfDay }, status: { not: "CANCELLED" } },
    }),
    prisma.order.count({
      where: { checkOutAt: { gte: startOfDay, lt: endOfDay }, status: { not: "CANCELLED" } },
    }),
    prisma.order.count({
      where: {
        appointmentAt: { gte: startOfDay, lt: endOfDay },
        queueType: { not: "OTHER" },
        status: { not: "CANCELLED" },
      },
    }),
  ]);

  // const revenueDay = paidDay._sum.total ?? 0;
  const dateLabel = formatDate(startOfDay);

  const stats = [
    // {
    //   label: isToday ? t.dashboard.statOrdersToday : t.dashboard.statOrders,
    //   value: dayOrders.toString(),
    //   icon: ReceiptText,
    //   color: "text-sky-600 bg-sky-100 dark:bg-sky-950 dark:text-sky-400",
    //   tint: "from-sky-50 dark:from-sky-950/30",
    // },
    // {
    //   label: isToday ? t.dashboard.statRevenueToday : t.dashboard.statRevenue,
    //   value: formatBaht(revenueDay),
    //   icon: TrendingUp,
    //   color: "text-emerald-600 bg-emerald-100 dark:bg-emerald-950 dark:text-emerald-400",
    //   tint: "from-emerald-50 dark:from-emerald-950/30",
    // },
    // {
    //   label: t.dashboard.statPendingPayment,
    //   value: pendingPayments.toString(),
    //   icon: Clock,
    //   color: "text-amber-600 bg-amber-100 dark:bg-amber-950 dark:text-amber-400",
    //   tint: "from-amber-50 dark:from-amber-950/30",
    // },
    // {
    //   label: t.dashboard.statTotalCustomers,
    //   value: customerCount.toString(),
    //   icon: PawPrint,
    //   color: "text-violet-600 bg-violet-100 dark:bg-violet-950 dark:text-violet-400",
    //   tint: "from-violet-50 dark:from-violet-950/30",
    // },
    {
      label: t.dashboard.statCheckInsToday,
      value: checkInsToday.toString(),
      icon: LogIn,
      color: "text-teal-600 bg-teal-100 dark:bg-teal-950 dark:text-teal-400",
      tint: "from-teal-50 dark:from-teal-950/30",
    },
    {
      label: t.dashboard.statCheckOutsToday,
      value: checkOutsToday.toString(),
      icon: LogOut,
      color: "text-orange-600 bg-orange-100 dark:bg-orange-950 dark:text-orange-400",
      tint: "from-orange-50 dark:from-orange-950/30",
    },
    {
      label: t.dashboard.statGroomingQueueToday,
      value: groomingQueueToday.toString(),
      icon: Bath,
      color: "text-pink-600 bg-pink-100 dark:bg-pink-950 dark:text-pink-400",
      tint: "from-pink-50 dark:from-pink-950/30",
    },
  ];

  return (
    <div>
      <PageHeader
        title={t.dashboard.title}
        description={isToday ? t.dashboard.overviewToday : t.dashboard.overviewOn(formatDate(startOfDay))}
        action={
          <>
            <Button render={<Link href="/register" />} nativeButton={false} variant="outline">
              <PawPrint /> {t.dashboard.register}
            </Button>
            <Button render={<Link href="/calendar" />} nativeButton={false}>
              <ClipboardPlus /> {t.dashboard.bookOrder}
            </Button>
          </>
        }
      />

      <div className="mb-4">
        <DashboardDatePicker value={selectedDateStr} />
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {stats.map((s) => {
          const Icon = s.icon;
          return (
            <Card key={s.label} className="w-full">
              <CardContent className="flex items-center gap-3.5 py-2">
                <div
                  className={cn(
                    "flex h-11 w-11 shrink-0 items-center justify-center rounded-lg",
                    s.color
                  )}
                >
                  <Icon className="h-5 w-5" />
                </div>
                <div className="min-w-0">
                  <div className="truncate text-2xl font-semibold tracking-tight">{s.value}</div>
                  <div className="text-xs text-muted-foreground">{s.label}</div>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      <Card className="mt-6">
        <CardHeader className="flex-row items-center justify-between">
          <CardTitle className="text-base">
            {isToday ? t.dashboard.ordersToday : t.dashboard.ordersOn(dateLabel)}
          </CardTitle>
          <Button render={<Link href="/orders" />} nativeButton={false} variant="ghost" size="sm">
            {t.dashboard.viewAll}
          </Button>
        </CardHeader>
        <CardContent>
          {dayOrderList.length === 0 ? (
            <div className="flex flex-col items-center gap-3 py-10 text-center">
              <Wallet className="h-10 w-10 text-muted-foreground/40" />
              <p className="text-sm text-muted-foreground">
                {isToday ? t.dashboard.noOrdersToday : t.dashboard.noOrdersOn(dateLabel)}
              </p>
              <Button render={<Link href="/calendar" />} nativeButton={false} size="sm">
                {t.dashboard.bookOrder}
              </Button>
            </div>
          ) : (
            <div className="divide-y">
              {dayOrderList.map((o) => {
                const paidSum = o.payments.reduce((sum, p) => sum + p.amount, 0);
                const isUnderpaid = o.status === "COMPLETED" && paidSum < o.total;
                return (
                <Link
                  key={o.id}
                  href={`/orders/${o.id}`}
                  className="flex items-center justify-between gap-3 py-3 transition-colors hover:bg-accent/50 -mx-2 px-2 rounded-lg"
                >
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-medium">{o.code}</span>
                      <Badge variant="outline" className={cn("text-[10px]", orderStatusColor[o.status])}>
                        {t.labels.orderStatus[o.status]}
                      </Badge>
                      {isUnderpaid && (
                        <Badge
                          variant="outline"
                          className="border-red-300 bg-red-50 text-[10px] font-semibold text-red-600 dark:border-red-900 dark:bg-red-950/40 dark:text-red-400"
                        >
                          {t.dashboard.underpaidBadge}
                        </Badge>
                      )}
                    </div>
                    <div className="truncate text-xs text-muted-foreground">
                      {o.customer.name}
                      {o.pet ? ` · ${o.pet.name}` : ""} · {formatDateTime(o.createdAt)}
                    </div>
                  </div>
                  <div className="shrink-0 font-semibold">{formatBaht(o.total)}</div>
                </Link>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
