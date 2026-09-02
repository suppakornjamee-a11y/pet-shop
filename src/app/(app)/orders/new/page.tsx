import { redirect } from "next/navigation";
import { CalendarClock, BedDouble } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { isSlotAvailable } from "@/lib/booking";
import { isValidDateStr, isValidTimeStr, isPastSlot } from "@/lib/slots";
import { PageHeader } from "@/components/page-header";
import { OrderForm } from "@/components/order-form";
import { Badge } from "@/components/ui/badge";
import { getDictionary } from "@/i18n/get-dictionary";
import { getLocale } from "@/i18n/get-locale";
import { requireStaffUser } from "@/lib/auth-helpers";

export default async function NewOrderPage(props: PageProps<"/orders/new">) {
  await requireStaffUser();
  const searchParams = await props.searchParams;
  const customerId =
    typeof searchParams.customerId === "string" ? searchParams.customerId : undefined;
  const date = typeof searchParams.date === "string" ? searchParams.date : "";
  const time = typeof searchParams.time === "string" ? searchParams.time : "";
  const roomId = typeof searchParams.roomId === "string" ? searchParams.roomId : "";
  const checkIn = typeof searchParams.checkIn === "string" ? searchParams.checkIn : "";
  const queueType = searchParams.queueType === "OTHER" ? "OTHER" : "BATH";
  const calendarPath = queueType === "OTHER" ? "/calendar-other" : "/calendar";

  const hasQueueEntry = isValidDateStr(date) && isValidTimeStr(time);
  const hasRoomEntry = roomId.length > 0;

  // ต้องมาจาก /calendar (จองอาบน้ำ), /calendar-other (จองบริการอื่นๆ) หรือ /boarding (จองห้อง/พื้นที่) อย่างใดอย่างหนึ่งเสมอ
  if (!hasQueueEntry && !hasRoomEntry) {
    redirect("/calendar");
  }
  if (hasQueueEntry) {
    // จองย้อนหลังไม่ได้
    if (isPastSlot(date, time)) redirect(`${calendarPath}?date=${date}`);
    // ถ้าช่วงเวลาถูกจองไปแล้ว ให้กลับไปเลือกใหม่
    if (!(await isSlotAvailable(date, time, undefined, queueType))) {
      redirect(`${calendarPath}?date=${date}`);
    }
  }

  const [services, rooms, products, preselected] = await Promise.all([
    prisma.service.findMany({
      where: {
        active: true,
        // มาจากปฏิทิน "จองอาบน้ำ" → เฉพาะอาบน้ำ/ตัดขน, "จองบริการอื่นๆ" → เฉพาะหมวดอื่นๆ (เทรนนิ่ง/ฟิตเนส)
        ...(hasQueueEntry
          ? queueType === "OTHER"
            ? { category: "OTHER" as const }
            : { category: { in: ["BATH", "GROOMING"] } }
          : {}),
      },
      orderBy: { category: "asc" },
    }),
    prisma.room.findMany({
      where: { active: true },
      include: { category: true },
      orderBy: [{ category: { sortOrder: "asc" } }, { sortOrder: "asc" }],
    }),
    prisma.product.findMany({
      where: { active: true, target: "PET" },
      orderBy: { name: "asc" },
    }),
    customerId
      ? prisma.customer.findUnique({ where: { id: customerId }, include: { pets: true } })
      : Promise.resolve(null),
  ]);

  const locale = await getLocale();
  const t = getDictionary(locale);

  const dateLabel = hasQueueEntry
    ? new Intl.DateTimeFormat(locale === "th" ? "th-TH" : "en-US", {
        dateStyle: "full",
        timeZone: "UTC",
      }).format(new Date(`${date}T00:00:00Z`))
    : null;

  return (
    <div className="mx-auto max-w-5xl">
      <PageHeader
        title={t.orders.createTitle}
        description={t.orders.createDescription}
        action={
          hasQueueEntry ? (
            <Badge variant="outline" className="gap-1.5 px-3 py-1.5 text-sm">
              <CalendarClock className="h-4 w-4 text-primary" />
              {t.orders.queueBadge(dateLabel ?? "", time)}
            </Badge>
          ) : (
            <Badge variant="outline" className="gap-1.5 px-3 py-1.5 text-sm">
              <BedDouble className="h-4 w-4 text-primary" />
              {t.orders.roomBookingBadge}
            </Badge>
          )
        }
      />
      <OrderForm
        services={services}
        rooms={rooms.map((r) => ({
          id: r.id,
          categoryId: r.categoryId,
          categoryName: r.category.name,
          billingUnit: r.category.billingUnit,
          name: r.name,
          pricePerNight: r.pricePerNight,
          hasAir: r.hasAir,
          hasFan: r.hasFan,
          equipment: r.equipment,
        }))}
        products={products}
        preselected={
          preselected
            ? {
                ...preselected,
                pets: preselected.pets.map((p) => ({
                  ...p,
                  lastFleaTickAt: p.lastFleaTickAt?.toISOString() ?? null,
                })),
              }
            : null
        }
        appointmentDate={hasQueueEntry ? date : undefined}
        appointmentTime={hasQueueEntry ? time : undefined}
        queueType={queueType}
        initial={
          hasRoomEntry
            ? { roomId, checkInDate: isValidDateStr(checkIn) ? checkIn : undefined }
            : undefined
        }
      />
    </div>
  );
}
