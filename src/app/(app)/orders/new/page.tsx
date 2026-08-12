import { redirect } from "next/navigation";
import { CalendarClock } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { isSlotAvailable } from "@/app/actions/orders";
import { isValidDateStr, isValidTimeStr } from "@/lib/slots";
import { PageHeader } from "@/components/page-header";
import { OrderForm } from "@/components/order-form";
import { Badge } from "@/components/ui/badge";

export default async function NewOrderPage(props: PageProps<"/orders/new">) {
  const searchParams = await props.searchParams;
  const customerId =
    typeof searchParams.customerId === "string" ? searchParams.customerId : undefined;
  const date = typeof searchParams.date === "string" ? searchParams.date : "";
  const time = typeof searchParams.time === "string" ? searchParams.time : "";

  // ต้องเลือกวัน-เวลาคิวจากปฏิทินก่อนเสมอ
  if (!isValidDateStr(date) || !isValidTimeStr(time)) {
    redirect("/calendar");
  }
  // ถ้าช่วงเวลาถูกจองไปแล้ว ให้กลับไปเลือกใหม่
  if (!(await isSlotAvailable(date, time))) {
    redirect(`/calendar?date=${date}`);
  }

  const [services, rooms, products, preselected] = await Promise.all([
    prisma.service.findMany({ where: { active: true }, orderBy: { category: "asc" } }),
    prisma.room.findMany({ where: { active: true }, orderBy: { name: "asc" } }),
    prisma.product.findMany({
      where: { active: true, target: "PET" },
      orderBy: { name: "asc" },
    }),
    customerId
      ? prisma.customer.findUnique({ where: { id: customerId }, include: { pets: true } })
      : Promise.resolve(null),
  ]);

  const dateLabel = new Intl.DateTimeFormat("th-TH", {
    dateStyle: "full",
    timeZone: "UTC",
  }).format(new Date(`${date}T00:00:00Z`));

  return (
    <div className="mx-auto max-w-5xl">
      <PageHeader
        title="สร้างออเดอร์"
        description="เลือกบริการ ห้องพัก และสินค้า แล้วสร้าง QR ให้ลูกค้าชำระเงิน"
        action={
          <Badge variant="outline" className="gap-1.5 px-3 py-1.5 text-sm">
            <CalendarClock className="h-4 w-4 text-primary" />
            คิว: {dateLabel} · {time} น.
          </Badge>
        }
      />
      <OrderForm
        services={services}
        rooms={rooms}
        products={products}
        preselected={preselected}
        appointmentDate={date}
        appointmentTime={time}
      />
    </div>
  );
}
