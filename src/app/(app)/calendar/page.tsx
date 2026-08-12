import Link from "next/link";
import { ChevronLeft, ChevronRight, Clock, Plus, CheckCircle2 } from "lucide-react";
import { prisma } from "@/lib/prisma";
import {
  TIME_SLOTS,
  toThaiDateStr,
  toThaiTimeStr,
  todayThaiStr,
  thaiMonthRange,
  isValidDateStr,
} from "@/lib/slots";
import { orderStatusLabel, orderStatusColor, speciesEmoji } from "@/lib/labels";
import { cn } from "@/lib/utils";
import { PageHeader } from "@/components/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

const WEEKDAYS = ["อา", "จ", "อ", "พ", "พฤ", "ศ", "ส"];

export default async function CalendarPage(props: PageProps<"/calendar">) {
  const sp = await props.searchParams;
  const today = todayThaiStr();
  const monthStr =
    typeof sp.month === "string" && /^\d{4}-\d{2}$/.test(sp.month)
      ? sp.month
      : today.slice(0, 7);
  const selectedDate =
    typeof sp.date === "string" && isValidDateStr(sp.date) ? sp.date : today;
  const customerId = typeof sp.customerId === "string" ? sp.customerId : undefined;
  const cq = customerId ? `&customerId=${customerId}` : "";

  const [y, m] = monthStr.split("-").map(Number);

  // จองในเดือนนี้ (ไม่รวมที่ยกเลิก)
  const { start, end } = thaiMonthRange(monthStr);
  const bookings = await prisma.order.findMany({
    where: {
      appointmentAt: { gte: start, lt: end },
      status: { not: "CANCELLED" },
    },
    include: { customer: true, pet: true },
    orderBy: { appointmentAt: "asc" },
  });

  // นับต่อวัน + หาคิวของวันที่เลือก
  const countByDay = new Map<string, number>();
  for (const b of bookings) {
    if (!b.appointmentAt) continue;
    const d = toThaiDateStr(b.appointmentAt);
    countByDay.set(d, (countByDay.get(d) ?? 0) + 1);
  }
  const dayBookings = bookings.filter(
    (b) => b.appointmentAt && toThaiDateStr(b.appointmentAt) === selectedDate
  );
  const bySlot = new Map<string, (typeof dayBookings)[number]>();
  for (const b of dayBookings) {
    if (b.appointmentAt) bySlot.set(toThaiTimeStr(b.appointmentAt), b);
  }

  // grid ของเดือน (คำนวณแบบไม่ผูก timezone)
  const daysInMonth = new Date(Date.UTC(y, m, 0)).getUTCDate();
  const leadingBlank = new Date(Date.UTC(y, m - 1, 1)).getUTCDay();
  const monthLabel = new Intl.DateTimeFormat("th-TH", {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(Date.UTC(y, m - 1, 1)));

  const prevMonth = new Date(Date.UTC(y, m - 2, 1));
  const nextMonth = new Date(Date.UTC(y, m, 1));
  const fmtMonth = (d: Date) =>
    `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;

  const cells: (number | null)[] = [
    ...Array(leadingBlank).fill(null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ];

  const selectedLabel = new Intl.DateTimeFormat("th-TH", {
    dateStyle: "full",
    timeZone: "UTC",
  }).format(new Date(`${selectedDate}T00:00:00Z`));

  return (
    <div className="mx-auto max-w-5xl">
      <PageHeader
        title="ปฏิทินคิว"
        description="เลือกวันและช่วงเวลาว่างก่อนสร้างออเดอร์ (กันคิวชนกัน)"
      />

      <div className="grid gap-6 lg:grid-cols-[1.3fr_1fr]">
        {/* ===== ปฏิทินเดือน ===== */}
        <Card>
          <CardHeader className="flex-row items-center justify-between">
            <CardTitle className="text-base">{monthLabel}</CardTitle>
            <div className="flex gap-1">
              <Button
                render={<Link href={`/calendar?month=${fmtMonth(prevMonth)}&date=${selectedDate}${cq}`} />}
                nativeButton={false}
                variant="outline"
                size="icon"
                className="h-8 w-8"
              >
                <ChevronLeft />
              </Button>
              <Button
                render={<Link href={`/calendar?month=${fmtMonth(nextMonth)}&date=${selectedDate}${cq}`} />}
                nativeButton={false}
                variant="outline"
                size="icon"
                className="h-8 w-8"
              >
                <ChevronRight />
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-7 gap-1 text-center">
              {WEEKDAYS.map((w) => (
                <div key={w} className="pb-1 text-xs font-medium text-muted-foreground">
                  {w}
                </div>
              ))}
              {cells.map((day, i) => {
                if (day === null) return <div key={`b${i}`} />;
                const dateStr = `${monthStr}-${String(day).padStart(2, "0")}`;
                const count = countByDay.get(dateStr) ?? 0;
                const isSelected = dateStr === selectedDate;
                const isToday = dateStr === today;
                return (
                  <Link
                    key={dateStr}
                    href={`/calendar?month=${monthStr}&date=${dateStr}${cq}`}
                    className={cn(
                      "flex aspect-square flex-col items-center justify-center rounded-lg border text-sm transition-colors",
                      isSelected
                        ? "border-primary bg-primary text-primary-foreground"
                        : "border-transparent hover:bg-accent",
                      !isSelected && isToday && "border-primary/40"
                    )}
                  >
                    <span className={cn(isToday && !isSelected && "font-bold text-primary")}>
                      {day}
                    </span>
                    {count > 0 && (
                      <span
                        className={cn(
                          "mt-0.5 rounded-full px-1.5 text-[10px] font-medium",
                          isSelected ? "bg-white/25" : "bg-primary/15 text-primary"
                        )}
                      >
                        {count} คิว
                      </span>
                    )}
                  </Link>
                );
              })}
            </div>
          </CardContent>
        </Card>

        {/* ===== ช่วงเวลาของวันที่เลือก ===== */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">{selectedLabel}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {TIME_SLOTS.map((slot) => {
              const booked = bySlot.get(slot);
              if (booked) {
                return (
                  <Link
                    key={slot}
                    href={`/orders/${booked.id}`}
                    className="flex items-center justify-between rounded-lg border bg-muted/40 px-3 py-2.5 text-sm transition-colors hover:bg-accent"
                  >
                    <div className="flex items-center gap-2.5">
                      <span className="font-mono font-semibold tabular-nums">{slot}</span>
                      <span className="text-muted-foreground">
                        {booked.pet ? `${speciesEmoji[booked.pet.species]} ` : ""}
                        {booked.customer.name}
                      </span>
                    </div>
                    <Badge
                      variant="outline"
                      className={cn("text-[10px]", orderStatusColor[booked.status])}
                    >
                      {orderStatusLabel[booked.status]}
                    </Badge>
                  </Link>
                );
              }
              return (
                <div
                  key={slot}
                  className="flex items-center justify-between rounded-lg border border-dashed px-3 py-2.5 text-sm"
                >
                  <div className="flex items-center gap-2.5 text-muted-foreground">
                    <Clock className="h-4 w-4" />
                    <span className="font-mono font-semibold tabular-nums">{slot}</span>
                    <span className="text-xs">ว่าง</span>
                  </div>
                  <Button
                    render={
                      <Link href={`/orders/new?date=${selectedDate}&time=${slot}${cq}`} />
                    }
                    nativeButton={false}
                    size="sm"
                  >
                    <Plus /> สร้างออเดอร์
                  </Button>
                </div>
              );
            })}
            <p className="flex items-center gap-1.5 pt-2 text-xs text-muted-foreground">
              <CheckCircle2 className="h-3.5 w-3.5" /> เลือกช่วงเวลาที่ว่างเพื่อสร้างออเดอร์ในคิวนั้น
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
