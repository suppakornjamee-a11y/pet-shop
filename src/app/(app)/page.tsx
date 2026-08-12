import Link from "next/link";
import {
  ClipboardPlus,
  PawPrint,
  Wallet,
  ReceiptText,
  Clock,
  TrendingUp,
} from "lucide-react";
import { prisma } from "@/lib/prisma";
import { formatBaht, formatDate, formatDateTime } from "@/lib/format";
import { orderStatusLabel, orderStatusColor } from "@/lib/labels";
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

  const [dayOrders, paidDay, pendingPayments, customerCount, dayOrderList] =
    await Promise.all([
      prisma.order.count({ where: { createdAt: { gte: startOfDay, lt: endOfDay } } }),
      prisma.order.aggregate({
        _sum: { total: true },
        where: {
          createdAt: { gte: startOfDay, lt: endOfDay },
          status: { in: ["PAID", "IN_PROGRESS", "COMPLETED"] },
        },
      }),
      prisma.order.count({ where: { status: "PENDING_PAYMENT" } }),
      prisma.customer.count(),
      prisma.order.findMany({
        where: { createdAt: { gte: startOfDay, lt: endOfDay } },
        take: 10,
        orderBy: { createdAt: "desc" },
        include: { customer: true, pet: true },
      }),
    ]);

  const revenueDay = paidDay._sum.total ?? 0;
  const dateLabel = isToday ? "วันนี้" : formatDate(startOfDay);

  const stats = [
    {
      label: `ออเดอร์${isToday ? "วันนี้" : ""}`,
      value: dayOrders.toString(),
      icon: ReceiptText,
      color: "text-sky-600 bg-sky-100 dark:bg-sky-950 dark:text-sky-400",
      tint: "from-sky-50 dark:from-sky-950/30",
    },
    {
      label: `รายรับ${isToday ? "วันนี้" : ""}`,
      value: formatBaht(revenueDay),
      icon: TrendingUp,
      color: "text-emerald-600 bg-emerald-100 dark:bg-emerald-950 dark:text-emerald-400",
      tint: "from-emerald-50 dark:from-emerald-950/30",
    },
    {
      label: "รอชำระเงิน",
      value: pendingPayments.toString(),
      icon: Clock,
      color: "text-amber-600 bg-amber-100 dark:bg-amber-950 dark:text-amber-400",
      tint: "from-amber-50 dark:from-amber-950/30",
    },
    {
      label: "ลูกค้าทั้งหมด",
      value: customerCount.toString(),
      icon: PawPrint,
      color: "text-violet-600 bg-violet-100 dark:bg-violet-950 dark:text-violet-400",
      tint: "from-violet-50 dark:from-violet-950/30",
    },
  ];

  return (
    <div>
      <PageHeader
        title="แดชบอร์ด"
        description={`ภาพรวมร้าน${isToday ? "วันนี้" : `วันที่ ${formatDate(startOfDay)}`}`}
        action={
          <>
            <Button render={<Link href="/register" />} nativeButton={false} variant="outline">
              <PawPrint /> ลงทะเบียน
            </Button>
            <Button render={<Link href="/calendar" />} nativeButton={false}>
              <ClipboardPlus /> จองคิว / สร้างออเดอร์
            </Button>
          </>
        }
      />

      <div className="mb-4">
        <DashboardDatePicker value={selectedDateStr} />
      </div>

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {stats.map((s) => {
          const Icon = s.icon;
          return (
            <Card key={s.label}>
              <CardContent className="flex items-center gap-3.5 py-2">
                <div
                  className={cn(
                    "flex h-11 w-11 items-center justify-center rounded-lg",
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
          <CardTitle className="text-base">ออเดอร์{dateLabel}</CardTitle>
          <Button render={<Link href="/orders" />} nativeButton={false} variant="ghost" size="sm">
            ดูทั้งหมด
          </Button>
        </CardHeader>
        <CardContent>
          {dayOrderList.length === 0 ? (
            <div className="flex flex-col items-center gap-3 py-10 text-center">
              <Wallet className="h-10 w-10 text-muted-foreground/40" />
              <p className="text-sm text-muted-foreground">ไม่มีออเดอร์ใน{dateLabel}</p>
              <Button render={<Link href="/calendar" />} nativeButton={false} size="sm">
                จองคิว / สร้างออเดอร์
              </Button>
            </div>
          ) : (
            <div className="divide-y">
              {dayOrderList.map((o) => (
                <Link
                  key={o.id}
                  href={`/orders/${o.id}`}
                  className="flex items-center justify-between gap-3 py-3 transition-colors hover:bg-accent/50 -mx-2 px-2 rounded-lg"
                >
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-medium">{o.code}</span>
                      <Badge variant="outline" className={cn("text-[10px]", orderStatusColor[o.status])}>
                        {orderStatusLabel[o.status]}
                      </Badge>
                    </div>
                    <div className="truncate text-xs text-muted-foreground">
                      {o.customer.name}
                      {o.pet ? ` · ${o.pet.name}` : ""} · {formatDateTime(o.createdAt)}
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
