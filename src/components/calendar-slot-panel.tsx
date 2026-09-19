import Link from "next/link";
import { Clock } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth-helpers";
import { isSlotHolding } from "@/lib/booking";
import { getStatusBadgeInfo } from "@/lib/order-kind";
import { SLOT_CAPACITY, TIME_SLOTS, isPastSlot, thaiDayRange, toThaiTimeStr } from "@/lib/slots";
import { cn } from "@/lib/utils";
import { SpeciesIcon } from "@/components/species-icon";
import { OrderStatusBadges } from "@/components/order-status-badges";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getDictionary } from "@/i18n/get-dictionary";
import { getLocale } from "@/i18n/get-locale";

/**
 * แผงช่วงเวลาของวันที่เลือก (ฝั่งขวาของหน้าปฏิทิน) — ทุกช่วงบอกว่ารับไปแล้วกี่ตัวจาก SLOT_CAPACITY
 * และใครจองอยู่บ้าง กดชื่อไปหน้ารายละเอียดออเดอร์
 *
 * ใช้ร่วมกันทั้งหน้าจองอาบน้ำและจองบริการอื่นๆ ต่างแค่พูลคิว — ออเดอร์เก่าที่ queueType เป็น null
 * นับเป็นพูลอาบน้ำ (ตรงกับ isSlotAvailable) ส่วนเวลาที่ไม่อยู่ในช่วงสำเร็จรูป (เช่นลูกค้าจองเอง 10:30)
 * ต่อแถวเพิ่มเข้าไปตามเวลาจริง ไม่ให้คิวหายไปจากหน้าจอ
 */
export async function CalendarSlotPanel({
  dateStr,
  queueType,
}: {
  dateStr: string;
  queueType: "BATH" | "OTHER";
}) {
  const user = await requireUser();
  const t = getDictionary(await getLocale());
  const { start, end } = thaiDayRange(dateStr);

  const rows = await prisma.order.findMany({
    where: {
      appointmentAt: { gte: start, lt: end },
      ...(queueType === "BATH"
        ? { OR: [{ queueType: "BATH" as const }, { queueType: null }] }
        : { queueType: "OTHER" as const }),
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
      pet: { select: { name: true, species: true } },
      payments: { select: { status: true, amount: true, expiresAt: true } },
      extraCharges: { select: { amount: true } },
      activityLogs: {
        orderBy: { createdAt: "desc" },
        select: { action: true, createdById: true },
      },
    },
    orderBy: { createdAt: "asc" },
  });

  // เอาเฉพาะคิวที่ยังกันที่อยู่จริง — ใช้ isSlotHolding ตัวเดียวกับตอนเช็คว่าจองได้ไหม ตัวเลขจึงตรงกันเสมอ
  const bookings = rows.filter((o) => isSlotHolding(o));
  const byTime = new Map<string, typeof bookings>();
  for (const b of bookings) {
    const time = toThaiTimeStr(b.appointmentAt!);
    byTime.set(time, [...(byTime.get(time) ?? []), b]);
  }
  const times = [...new Set<string>([...TIME_SLOTS, ...byTime.keys()])].sort();

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">{t.calendar.slotsTitle}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        {times.map((time) => {
          const list = byTime.get(time) ?? [];
          const full = list.length >= SLOT_CAPACITY;
          const past = isPastSlot(dateStr, time);

          return (
            <div
              key={time}
              className={cn(
                "rounded-lg border px-3 py-2",
                list.length === 0 && "border-dashed",
                list.length === 0 && past && "opacity-50"
              )}
            >
              <div className="flex items-center justify-between gap-2 text-sm">
                <span className="inline-flex items-center gap-2">
                  <Clock className="h-3.5 w-3.5 text-muted-foreground" />
                  <span className="font-mono font-semibold tabular-nums">{time}</span>
                </span>
                <span
                  className={cn(
                    "rounded-full px-2 py-0.5 text-[0.6875rem] font-medium tabular-nums",
                    full
                      ? "bg-rose-100 text-rose-700 dark:bg-rose-950/50 dark:text-rose-300"
                      : list.length > 0
                        ? "bg-amber-100 text-amber-800 dark:bg-amber-950/50 dark:text-amber-300"
                        : "text-muted-foreground"
                  )}
                >
                  {list.length === 0
                    ? past
                      ? null
                      : t.calendar.slotFree
                    : full
                      ? t.calendar.slotFull(list.length, SLOT_CAPACITY)
                      : t.calendar.slotTaken(list.length, SLOT_CAPACITY)}
                </span>
              </div>

              {list.length > 0 && (
                <div className="mt-1.5 space-y-1">
                  {list.map((b) => (
                    <Link
                      key={b.id}
                      href={`/orders/${b.id}`}
                      className="-mx-1.5 flex items-center gap-2 rounded-md px-1.5 py-1 text-sm transition-colors hover:bg-accent"
                    >
                      {b.pet && <SpeciesIcon species={b.pet.species} className="h-3.5 w-3.5 shrink-0" />}
                      <span className="min-w-0 flex-1 truncate">
                        {b.customer?.name ?? t.common.walkInCustomer}
                        {b.pet && <span className="text-muted-foreground"> · {b.pet.name}</span>}
                      </span>
                      <OrderStatusBadges info={getStatusBadgeInfo(b, user)} t={t} size="xs" />
                    </Link>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}
