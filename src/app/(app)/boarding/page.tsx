import Link from "next/link";
import { ChevronLeft, ChevronRight, Plus } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { todayThaiStr, dateRangeThai, addDaysThai, thaiDayRange, isValidDateStr } from "@/lib/slots";
import { isSlotHolding } from "@/lib/booking";
import { buildRoomGrid, countSpeciesByDate, type GridBooking } from "@/lib/room-grid";
import { orderStatusColor } from "@/lib/labels";
import { cn } from "@/lib/utils";
import { PageHeader } from "@/components/page-header";
import { SpeciesIcon } from "@/components/species-icon";
import { Button } from "@/components/ui/button";
import { getDictionary } from "@/i18n/get-dictionary";
import { getLocale } from "@/i18n/get-locale";
import type { Dictionary } from "@/i18n/dictionaries/th";
import { requireStaffUser } from "@/lib/auth-helpers";

const WINDOW_DAYS = 14;

export default async function BoardingPage(props: PageProps<"/boarding">) {
  await requireStaffUser();
  const sp = await props.searchParams;
  const locale = await getLocale();
  const t = getDictionary(locale);
  const WEEKDAYS = t.common.weekdaysShort;
  const intlLocale = locale === "th" ? "th-TH" : "en-US";
  const today = todayThaiStr();
  const start = typeof sp.start === "string" && isValidDateStr(sp.start) ? sp.start : today;
  const dateRange = dateRangeThai(start, WINDOW_DAYS);
  const prevStart = addDaysThai(start, -WINDOW_DAYS);
  const nextStart = addDaysThai(start, WINDOW_DAYS);

  const rangeStart = thaiDayRange(dateRange[0]).start;
  const rangeEnd = thaiDayRange(dateRange[dateRange.length - 1]).end;

  const [rooms, rawOrders] = await Promise.all([
    prisma.room.findMany({
      where: { active: true },
      include: { category: true },
      orderBy: [{ category: { sortOrder: "asc" } }, { sortOrder: "asc" }],
    }),
    prisma.order.findMany({
      where: {
        roomId: { not: null },
        checkInAt: { lt: rangeEnd },
        checkOutAt: { gt: rangeStart },
      },
      include: {
        customer: true,
        pet: true,
        payments: { select: { status: true, expiresAt: true } },
      },
    }),
  ]);

  const bookings = rawOrders
    .filter((o) => o.roomId && o.checkInAt && o.checkOutAt && isSlotHolding(o))
    .map(
      (o) =>
        ({
          orderId: o.id,
          roomId: o.roomId!,
          status: o.status,
          customerName: o.customer.name,
          petName: o.pet?.name ?? null,
          petBreed: o.pet?.breed ?? null,
          petSpecies: o.pet?.species ?? null,
          checkInAt: o.checkInAt!,
          checkOutAt: o.checkOutAt!,
          nannyType: o.nannyType,
          depositAmount: o.depositAmount,
          vaccineComplete: o.vaccineComplete,
          lastFleaTickAt: o.lastFleaTickAt,
          fleaTickMedicine: o.fleaTickMedicine,
        }) satisfies GridBooking & { roomId: string }
    );

  const gridRooms = rooms.map((r) => ({
    id: r.id,
    name: r.name,
    sortOrder: r.sortOrder,
    categoryId: r.categoryId,
    categoryName: r.category.name,
    categorySortOrder: r.category.sortOrder,
    billingUnit: r.category.billingUnit,
  }));

  const sections = buildRoomGrid(gridRooms, bookings, dateRange);
  const speciesCounts = countSpeciesByDate(bookings, dateRange);

  const dayLabel = (dateStr: string) => {
    const d = new Date(`${dateStr}T00:00:00Z`);
    return {
      day: d.getUTCDate(),
      weekday: WEEKDAYS[d.getUTCDay()],
      isToday: dateStr === today,
    };
  };

  const rangeLabel = `${new Intl.DateTimeFormat(intlLocale, { dateStyle: "medium", timeZone: "UTC" }).format(
    new Date(`${dateRange[0]}T00:00:00Z`)
  )} – ${new Intl.DateTimeFormat(intlLocale, { dateStyle: "medium", timeZone: "UTC" }).format(
    new Date(`${dateRange[dateRange.length - 1]}T00:00:00Z`)
  )}`;

  return (
    <div className="mx-auto max-w-[1400px]">
      <PageHeader
        title={t.boarding.title}
        action={
          <div className="flex items-center gap-1.5">
            <Button
              render={<Link href={`/boarding?start=${prevStart}`} />}
              nativeButton={false}
              variant="outline"
              size="icon"
            >
              <ChevronLeft />
            </Button>
            <span className="px-2 text-sm font-medium text-muted-foreground">{rangeLabel}</span>
            <Button
              render={<Link href={`/boarding?start=${nextStart}`} />}
              nativeButton={false}
              variant="outline"
              size="icon"
            >
              <ChevronRight />
            </Button>
          </div>
        }
      />

      <div className="overflow-x-auto rounded-lg border">
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr>
              <th className="sticky left-0 top-0 z-20 min-w-[180px] border-r border-b bg-card px-3 py-2 text-left text-xs font-semibold text-muted-foreground">
                {t.boarding.roomColumnHeader}
              </th>
              {dateRange.map((d) => {
                const { day, weekday, isToday } = dayLabel(d);
                const counts = speciesCounts[d];
                return (
                  <th
                    key={d}
                    className={cn(
                      "sticky top-0 z-10 min-w-[64px] border-b px-1 py-2 text-center text-xs font-medium",
                      isToday ? "bg-primary/10 text-primary" : "bg-card text-muted-foreground"
                    )}
                  >
                    <div>{weekday}</div>
                    <div className={cn("text-sm", isToday && "font-bold")}>{day}</div>
                    {(counts.dog > 0 || counts.cat > 0) && (
                      <div className="mt-0.5 flex items-center justify-center gap-1 text-[9px] leading-none font-normal text-muted-foreground/80">
                        {counts.dog > 0 && (
                          <span className="inline-flex items-center gap-0.5">
                            <SpeciesIcon species="DOG" className="h-2.5 w-2.5" /> {counts.dog}
                          </span>
                        )}
                        {counts.cat > 0 && (
                          <span className="inline-flex items-center gap-0.5">
                            <SpeciesIcon species="CAT" className="h-2.5 w-2.5" /> {counts.cat}
                          </span>
                        )}
                      </div>
                    )}
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            {sections.map((section) => (
              <SectionRows key={section.categoryId} section={section} dateRangeLength={dateRange.length} t={t} />
            ))}
            {sections.length === 0 && (
              <tr>
                <td colSpan={dateRange.length + 1} className="px-3 py-10 text-center text-muted-foreground">
                  {t.boarding.noRooms}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function SectionRows({
  section,
  dateRangeLength,
  t,
}: {
  section: ReturnType<typeof buildRoomGrid>[number];
  dateRangeLength: number;
  t: Dictionary;
}) {
  return (
    <>
      <tr>
        <td
          colSpan={dateRangeLength + 1}
          className="sticky left-0 z-10 bg-primary/15 px-3 py-1 text-xs font-bold tracking-wide text-primary"
        >
          {section.categoryName}
        </td>
      </tr>
      {section.rows.map(({ room, segments }) => (
        <tr key={room.id} className="border-b">
          <td className="sticky left-0 z-10 border-r bg-card px-3 py-2 text-xs font-medium">
            {room.name}
          </td>
          {segments.map((seg) =>
            seg.kind === "empty" ? (
              <td key={seg.dateStr} className="border-r p-0.5">
                <Link
                  href={`/orders/new?roomId=${room.id}&checkIn=${seg.dateStr}`}
                  className="flex h-12 items-center justify-center rounded text-muted-foreground/30 transition-colors hover:bg-accent hover:text-primary"
                >
                  <Plus className="h-3.5 w-3.5" />
                </Link>
              </td>
            ) : (
              <td key={seg.startDateStr} colSpan={seg.days} className="border-r p-0.5">
                <Link
                  href={`/orders/${seg.booking.orderId}`}
                  className={cn(
                    "flex h-12 flex-col items-center justify-center overflow-hidden rounded border px-1.5 py-0.5 text-center text-[11px] leading-tight transition-opacity hover:opacity-80",
                    orderStatusColor[seg.booking.status]
                  )}
                >
                  <div className="truncate font-bold">
                    {seg.continuesFromBefore && seg.booking.status !== "COMPLETED" && "← "}
                    {seg.booking.petName ?? seg.booking.customerName}
                    {seg.continuesAfter && seg.booking.status !== "COMPLETED" && " →"}
                  </div>
                  <div className="truncate opacity-80">
                    {t.labels.orderStatus[seg.booking.status]}
                    {seg.booking.nannyType === "REGULAR" && t.boarding.nannyTag}
                    {seg.booking.nannyType === "VIP" && t.boarding.nannyVipTag}
                    {seg.booking.depositAmount > 0 && t.boarding.depositTag(seg.booking.depositAmount)}
                  </div>
                </Link>
              </td>
            )
          )}
        </tr>
      ))}
    </>
  );
}
