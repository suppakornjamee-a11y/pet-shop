import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { prisma } from "@/lib/prisma";
import {
  toThaiDateStr,
  todayThaiStr,
  thaiMonthRange,
  isValidDateStr,
} from "@/lib/slots";
import { firstOpenSlot, isSlotHolding } from "@/lib/booking";
import { requireUser } from "@/lib/auth-helpers";
import { cn } from "@/lib/utils";
import { PageHeader } from "@/components/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { CalendarDayBookings } from "@/components/calendar-day-bookings";
import { getDictionary } from "@/i18n/get-dictionary";
import { getLocale } from "@/i18n/get-locale";

export default async function CalendarPage(props: PageProps<"/calendar">) {
  await requireUser();
  const sp = await props.searchParams;
  const locale = await getLocale();
  const t = getDictionary(locale);
  const WEEKDAYS = t.common.weekdaysShort;
  const intlLocale = locale === "th" ? "th-TH" : "en-US";
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

  // จองในเดือนนี้ — เก็บเฉพาะที่ยัง "กันคิว" อยู่ (จ่ายแล้ว หรือรอชำระยังไม่หมดอายุ)
  // ดึงเท่าที่ isSlotHolding ต้องใช้ + วันนัด เพราะหน้านี้ใช้แค่ "นับจำนวนคิวต่อวัน" อย่างเดียว
  const rawBookings = await prisma.order.findMany({
    where: { appointmentAt: { gte: thaiMonthRange(monthStr).start, lt: thaiMonthRange(monthStr).end } },
    select: {
      appointmentAt: true,
      status: true,
      payments: { select: { status: true, expiresAt: true } },
    },
  });
  const bookings = rawBookings.filter((b) => isSlotHolding(b));

  const countByDay = new Map<string, number>();
  for (const b of bookings) {
    if (!b.appointmentAt) continue;
    const d = toThaiDateStr(b.appointmentAt);
    countByDay.set(d, (countByDay.get(d) ?? 0) + 1);
  }

  // grid ของเดือน (คำนวณแบบไม่ผูก timezone)
  const daysInMonth = new Date(Date.UTC(y, m, 0)).getUTCDate();
  const leadingBlank = new Date(Date.UTC(y, m - 1, 1)).getUTCDay();
  const monthLabel = new Intl.DateTimeFormat(intlLocale, {
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

  const selectedLabel = new Intl.DateTimeFormat(intlLocale, {
    dateStyle: "full",
    timeZone: "UTC",
  }).format(new Date(`${selectedDate}T00:00:00Z`));

  const isPastDate = selectedDate < today;
  // /orders/new ต้องได้ทั้งวันและเวลา ไม่งั้นเด้งกลับมาที่นี่ — ส่งช่วงเวลาว่างช่วงแรกของวันไปให้
  // เป็นค่าตั้งต้น (พนักงานแก้เวลาในฟอร์มต่อได้) ถ้าเต็มทั้งวันก็บอกไปตรงๆ แทนที่จะให้กดแล้วเด้ง
  const openSlot = isPastDate ? null : await firstOpenSlot(selectedDate, "BATH");

  return (
    <div className="mx-auto max-w-2xl">
      <PageHeader title={t.calendar.title} />

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
        <CardContent className="space-y-4">
          {/* วันที่เลือกไว้ + ปุ่มเปิดออเดอร์ อยู่บนสุด เห็นก่อนต้องเลื่อนดูปฏิทิน */}
          <div className="flex flex-wrap items-center justify-between gap-3 border-b pb-4">
            <p className="text-sm font-medium">{selectedLabel}</p>
            {isPastDate ? null : !openSlot ? (
              <p className="rounded-lg border border-dashed px-3 py-2.5 text-center text-xs text-muted-foreground">
                {t.calendar.dayFullNotice}
              </p>
            ) : (
              <Button
                render={<Link href={`/orders/new?date=${selectedDate}&time=${openSlot}${cq}`} />}
                nativeButton={false}
              >
                {t.calendar.openOrder}
              </Button>
            )}
          </div>
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
              const isPastDay = dateStr < today;

              const badge = count > 0 && (
                <span
                  className={cn(
                    "mt-0.5 rounded-full px-1.5 text-[10px] font-medium",
                    isSelected ? "bg-white/25" : "bg-primary/15 text-primary"
                  )}
                >
                  {t.calendar.queueCountBadge(count)}
                </span>
              );

              // วันที่ผ่านมาแล้ว — จองไม่ได้ (แต่ยังคลิกดูได้)
              if (isPastDay) {
                return (
                  <Link
                    key={dateStr}
                    href={`/calendar?month=${monthStr}&date=${dateStr}${cq}`}
                    className={cn(
                      "flex aspect-square flex-col items-center justify-center rounded-lg border border-transparent text-sm text-muted-foreground/40 transition-colors hover:bg-accent/50",
                      isSelected && "border-border bg-muted text-muted-foreground"
                    )}
                  >
                    <span>{day}</span>
                    {badge}
                  </Link>
                );
              }

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
                  {badge}
                </Link>
              );
            })}
          </div>

          <CalendarDayBookings dateStr={selectedDate} />
        </CardContent>
      </Card>
    </div>
  );
}
