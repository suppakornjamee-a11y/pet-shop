import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth-helpers";
import { isSlotHolding } from "@/lib/booking";
import { getStatusBadgeInfo } from "@/lib/order-kind";
import { thaiDayRange, toThaiTimeStr } from "@/lib/slots";
import { SpeciesIcon } from "@/components/species-icon";
import { OrderStatusBadges } from "@/components/order-status-badges";
import { getDictionary } from "@/i18n/get-dictionary";
import { getLocale } from "@/i18n/get-locale";

/**
 * ตารางคิวของวันที่เลือกในหน้าปฏิทิน — กดแถวไหนก็ไปหน้ารายละเอียดออเดอร์นั้น
 *
 * แยกเป็นคอมโพเนนต์กลางเพราะหน้าจองอาบน้ำกับจองบริการอื่นๆ ใช้ตารางหน้าตาเดียวกัน ต่างแค่พูลคิว
 * ไม่แสดงอะไรเลยถ้าวันนั้นไม่มีคิว (หน้าปฏิทินจะได้ไม่มีกล่องว่างค้างอยู่)
 *
 * queueType เว้นไว้ = ไม่กรองพูลคิว ให้ตรงกับที่หน้าจองอาบน้ำนับจำนวนคิวต่อวันอยู่แล้ว
 */
export async function CalendarDayBookings({
  dateStr,
  queueType,
}: {
  dateStr: string;
  queueType?: "OTHER";
}) {
  const user = await requireUser();
  const t = getDictionary(await getLocale());
  const { start, end } = thaiDayRange(dateStr);

  const rows = await prisma.order.findMany({
    where: {
      appointmentAt: { gte: start, lt: end },
      ...(queueType === "OTHER" ? { queueType: "OTHER" as const } : {}),
    },
    select: {
      id: true,
      appointmentAt: true,
      status: true,
      orderType: true,
      roomId: true,
      queueType: true,
      total: true,
      customer: { select: { name: true } },
      pet: { select: { species: true } },
      payments: { select: { status: true, amount: true, expiresAt: true } },
      extraCharges: { select: { amount: true } },
      activityLogs: {
        orderBy: { createdAt: "desc" },
        select: { action: true, createdById: true },
      },
    },
    orderBy: { appointmentAt: "asc" },
  });

  // เอาเฉพาะคิวที่ยังมีผลอยู่จริง ให้ตรงกับตัวเลข "N คิว" ใต้วันที่ในปฏิทิน
  const bookings = rows.filter((o) => isSlotHolding(o));
  if (bookings.length === 0) return null;

  return (
    <div className="space-y-2 border-t pt-4">
      <p className="text-sm font-medium">{t.calendar.dayBookingsTitle(bookings.length)}</p>
      <div className="overflow-hidden rounded-lg border">
        <div className="flex items-center gap-3 border-b bg-muted/50 px-3 py-2 text-xs font-medium text-muted-foreground">
          <span className="w-12 shrink-0">{t.calendar.columnTime}</span>
          <span className="min-w-0 flex-1">{t.calendar.columnCustomer}</span>
          <span className="shrink-0">{t.common.status}</span>
        </div>
        {bookings.map((b) => (
          <Link
            key={b.id}
            href={`/orders/${b.id}`}
            className="flex items-center gap-3 border-b px-3 py-2.5 text-sm transition-colors last:border-b-0 hover:bg-accent"
          >
            <span className="w-12 shrink-0 font-mono font-semibold tabular-nums">
              {b.appointmentAt ? toThaiTimeStr(b.appointmentAt) : "—"}
            </span>
            <span className="inline-flex min-w-0 flex-1 items-center gap-1.5">
              {b.pet && <SpeciesIcon species={b.pet.species} className="h-3.5 w-3.5 shrink-0" />}
              <span className="truncate">{b.customer?.name ?? t.common.walkInCustomer}</span>
            </span>
            <OrderStatusBadges info={getStatusBadgeInfo(b, user)} t={t} size="xs" />
          </Link>
        ))}
      </div>
    </div>
  );
}
