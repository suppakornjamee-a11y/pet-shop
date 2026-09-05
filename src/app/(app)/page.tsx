import Link from "next/link";
// import { ClipboardPlus, PawPrint, ReceiptText, Clock, TrendingUp } from "lucide-react";
import { OrdersImageIcon } from "@/components/nav-icons";
import { prisma } from "@/lib/prisma";
import { cn } from "@/lib/utils";
import { formatDate, formatBaht, formatTime } from "@/lib/format";
import { getStatusBadgeInfo } from "@/lib/order-kind";
import { getLocale } from "@/i18n/get-locale";
import { getDictionary } from "@/i18n/get-dictionary";
import { PageHeader } from "@/components/page-header";
import { OrderStatusBadges } from "@/components/order-status-badges";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { DashboardDatePicker } from "@/components/dashboard-date-picker";
import { requireStaffUser } from "@/lib/auth-helpers";

function CheckInStatIcon({ className }: { className?: string }) {
  // eslint-disable-next-line @next/next/no-img-element
  return <img src="/images/icons/checkin.png" alt="" className={className} />;
}
function CheckOutStatIcon({ className }: { className?: string }) {
  // eslint-disable-next-line @next/next/no-img-element
  return <img src="/images/icons/checkout.png" alt="" className={className} />;
}
function GroomingQueueStatIcon({ className }: { className?: string }) {
  // eslint-disable-next-line @next/next/no-img-element
  return <img src="/images/icons/grooming-queue.png" alt="" className={className} />;
}
function CafeStatIcon({ className }: { className?: string }) {
  // eslint-disable-next-line @next/next/no-img-element
  return <img src="/images/icons/cafe.png" alt="" className={className} />;
}

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
  const user = await requireStaffUser();
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
    cafeBillsToday,
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
        payments: { select: { status: true, amount: true } },
        extraCharges: { select: { amount: true } },
        activityLogs: { select: { action: true, createdById: true } },
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
    // บิลร้านอาหาร/คาเฟ่ที่เปิดในวันนั้น (ไม่นับบิลที่ถูกยกเลิก)
    prisma.order.count({
      where: {
        orderType: "SHOP",
        createdAt: { gte: startOfDay, lt: endOfDay },
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
      icon: CheckInStatIcon,
      chip: "bg-teal-100 dark:bg-teal-950",
    },
    {
      label: t.dashboard.statCheckOutsToday,
      value: checkOutsToday.toString(),
      icon: CheckOutStatIcon,
      chip: "bg-red-100 dark:bg-red-950",
    },
    {
      label: t.dashboard.statGroomingQueueToday,
      value: groomingQueueToday.toString(),
      icon: GroomingQueueStatIcon,
      chip: "bg-amber-100 dark:bg-amber-950",
    },
    {
      label: t.dashboard.statCafeToday,
      value: cafeBillsToday.toString(),
      icon: CafeStatIcon,
      chip: "bg-sky-100 dark:bg-sky-950",
    },
  ];

  return (
    <div>
      {/* ตัวเลือกวันที่อยู่มุมขวาของหัวข้อ ให้เหมือนหน้าออเดอร์อาบน้ำ
          (ปุ่มลงทะเบียน/จองคิวเดิมคอมเม้นปิดไว้ ดู git history ถ้าต้องเปิดกลับ) */}
      <PageHeader
        title={t.dashboard.title}
        action={<DashboardDatePicker value={selectedDateStr} />}
      />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {stats.map((s) => {
          const Icon = s.icon;
          return (
            <Card key={s.label} className="w-full">
              <CardContent className="flex items-center gap-4 py-3.5">
                <div
                  className={cn(
                    "flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl",
                    s.chip
                  )}
                >
                  <Icon className="h-9 w-9" />
                </div>
                {/* กล่องข้อความชิดขวา แต่ตัวกล่องกว้างเท่าป้ายพอดี ตัวเลขจึงอยู่กึ่งกลางใต้คำ */}
                <div className="flex min-w-0 flex-1 justify-end pr-3">
                  <div className="min-w-0 text-center">
                    <div className="truncate text-sm text-muted-foreground">{s.label}</div>
                    <div className="truncate text-2xl font-semibold tracking-tight tabular-nums">
                      {s.value}
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      <Card className="mt-6">
        <CardHeader>
          <CardTitle className="text-base">
            {isToday ? t.dashboard.ordersToday(dateLabel) : t.dashboard.ordersOn(dateLabel)}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {dayOrderList.length === 0 ? (
            <div className="flex flex-col items-center gap-3 py-10 text-center">
              <OrdersImageIcon className="h-12 w-12 opacity-40" />
              <p className="text-sm text-muted-foreground">
                {isToday ? t.dashboard.noOrdersToday : t.dashboard.noOrdersOn(dateLabel)}
              </p>
            </div>
          ) : (
            <div className="divide-y">
              {dayOrderList.map((o) => {
                const paidSum = o.payments
                  .filter((p) => p.status === "VERIFIED")
                  .reduce((sum, p) => sum + p.amount, 0);
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
                      <OrderStatusBadges info={getStatusBadgeInfo(o, user)} t={t} size="xs" />
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
                      {o.customer?.name ?? t.common.walkInCustomer}
                      {o.pet ? ` (${o.pet.name})` : ""} {t.dashboard.timeLabel}{" "}
                      {formatTime(o.createdAt)}
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
