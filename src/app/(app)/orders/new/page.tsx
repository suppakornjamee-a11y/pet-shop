import { redirect } from "next/navigation";
import { CalendarClock, BedDouble } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { isSlotAvailable } from "@/app/actions/orders";
import { isValidDateStr, isValidTimeStr, isPastSlot } from "@/lib/slots";
import { PageHeader } from "@/components/page-header";
import { OrderForm } from "@/components/order-form";
import { Badge } from "@/components/ui/badge";

export default async function NewOrderPage(props: PageProps<"/orders/new">) {
  const searchParams = await props.searchParams;
  const customerId =
    typeof searchParams.customerId === "string" ? searchParams.customerId : undefined;
  const date = typeof searchParams.date === "string" ? searchParams.date : "";
  const time = typeof searchParams.time === "string" ? searchParams.time : "";
  const roomId = typeof searchParams.roomId === "string" ? searchParams.roomId : "";
  const checkIn = typeof searchParams.checkIn === "string" ? searchParams.checkIn : "";

  const hasQueueEntry = isValidDateStr(date) && isValidTimeStr(time);
  const hasRoomEntry = roomId.length > 0;

  // ต้องมาจาก /calendar (คิวอาบน้ำ/ตัดขน) หรือ /boarding (จองห้อง/พื้นที่) อย่างใดอย่างหนึ่งเสมอ
  if (!hasQueueEntry && !hasRoomEntry) {
    redirect("/calendar");
  }
  if (hasQueueEntry) {
    // จองย้อนหลังไม่ได้
    if (isPastSlot(date, time)) redirect(`/calendar?date=${date}`);
    // ถ้าช่วงเวลาถูกจองไปแล้ว ให้กลับไปเลือกใหม่
    if (!(await isSlotAvailable(date, time))) redirect(`/calendar?date=${date}`);
  }

  const [services, rooms, products, preselected] = await Promise.all([
    prisma.service.findMany({ where: { active: true }, orderBy: { category: "asc" } }),
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

  const dateLabel = hasQueueEntry
    ? new Intl.DateTimeFormat("th-TH", {
        dateStyle: "full",
        timeZone: "UTC",
      }).format(new Date(`${date}T00:00:00Z`))
    : null;

  return (
    <div className="mx-auto max-w-5xl">
      <PageHeader
        title="สร้างออเดอร์"
        description="เลือกบริการ ห้องพัก และสินค้า แล้วสร้าง QR ให้ลูกค้าชำระเงิน"
        action={
          hasQueueEntry ? (
            <Badge variant="outline" className="gap-1.5 px-3 py-1.5 text-sm">
              <CalendarClock className="h-4 w-4 text-primary" />
              คิว: {dateLabel} · {time} น.
            </Badge>
          ) : (
            <Badge variant="outline" className="gap-1.5 px-3 py-1.5 text-sm">
              <BedDouble className="h-4 w-4 text-primary" />
              จองห้อง/คอก/พื้นที่
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
        initial={
          hasRoomEntry
            ? { roomId, checkInDate: isValidDateStr(checkIn) ? checkIn : undefined }
            : undefined
        }
      />
    </div>
  );
}
