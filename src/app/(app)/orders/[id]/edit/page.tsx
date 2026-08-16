import { notFound, redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { toThaiDateStr, toThaiTimeStr } from "@/lib/slots";
import { PageHeader } from "@/components/page-header";
import { OrderForm } from "@/components/order-form";
import { getDictionary } from "@/i18n/get-dictionary";
import { getLocale } from "@/i18n/get-locale";

export default async function EditOrderPage(props: PageProps<"/orders/[id]/edit">) {
  const { id } = await props.params;

  const order = await prisma.order.findUnique({
    where: { id },
    include: {
      customer: { include: { pets: true } },
      items: true,
    },
  });
  if (!order) notFound();

  // แก้ไขได้เฉพาะออเดอร์ที่ยังรอชำระเงิน
  if (order.status !== "PENDING_PAYMENT") {
    redirect(`/orders/${id}`);
  }

  const [services, rooms, products] = await Promise.all([
    prisma.service.findMany({ where: { active: true }, orderBy: { category: "asc" } }),
    prisma.room.findMany({
      where: { active: true },
      include: { category: true },
      orderBy: [{ category: { sortOrder: "asc" } }, { sortOrder: "asc" }],
    }),
    prisma.product.findMany({ where: { active: true, target: "PET" }, orderBy: { name: "asc" } }),
  ]);

  const productQty: Record<string, number> = {};
  for (const it of order.items) {
    if (it.itemType === "PRODUCT" && it.refId) productQty[it.refId] = it.quantity;
  }
  const serviceIds = order.items
    .filter((i) => i.itemType === "SERVICE" && i.refId)
    .map((i) => i.refId as string);
  const t = getDictionary(await getLocale());

  return (
    <div className="mx-auto max-w-5xl">
      <PageHeader
        title={t.orders.editTitle(order.code)}
        description={t.orders.editDescription}
      />
      <OrderForm
        mode="edit"
        orderId={order.id}
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
        preselected={{
          id: order.customer.id,
          name: order.customer.name,
          phone: order.customer.phone,
          pets: order.customer.pets.map((p) => ({
            id: p.id,
            name: p.name,
            species: p.species,
            vaccineComplete: p.vaccineComplete,
            lastFleaTickAt: p.lastFleaTickAt?.toISOString() ?? null,
            fleaTickMedicine: p.fleaTickMedicine,
          })),
        }}
        appointmentDate={order.appointmentAt ? toThaiDateStr(order.appointmentAt) : undefined}
        appointmentTime={order.appointmentAt ? toThaiTimeStr(order.appointmentAt) : undefined}
        initial={{
          petId: order.petId,
          serviceIds,
          roomId: order.roomId,
          checkInDate: order.checkInAt ? toThaiDateStr(order.checkInAt) : undefined,
          checkInTime: order.checkInAt ? toThaiTimeStr(order.checkInAt) : undefined,
          checkOutDate: order.checkOutAt ? toThaiDateStr(order.checkOutAt) : undefined,
          checkOutTime: order.checkOutAt ? toThaiTimeStr(order.checkOutAt) : undefined,
          nanny: order.nanny,
          depositAmount: order.depositAmount,
          vaccineComplete: order.vaccineComplete,
          lastFleaTickDate: order.lastFleaTickAt ? toThaiDateStr(order.lastFleaTickAt) : undefined,
          fleaTickMedicine: order.fleaTickMedicine ?? undefined,
          productQty,
          note: order.note,
        }}
      />
    </div>
  );
}
