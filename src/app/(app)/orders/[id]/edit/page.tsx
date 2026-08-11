import { notFound, redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { PageHeader } from "@/components/page-header";
import { OrderForm } from "@/components/order-form";

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
    prisma.room.findMany({ where: { active: true }, orderBy: { name: "asc" } }),
    prisma.product.findMany({ where: { active: true, target: "PET" }, orderBy: { name: "asc" } }),
  ]);

  const productQty: Record<string, number> = {};
  for (const it of order.items) {
    if (it.itemType === "PRODUCT" && it.refId) productQty[it.refId] = it.quantity;
  }
  const serviceIds = order.items
    .filter((i) => i.itemType === "SERVICE" && i.refId)
    .map((i) => i.refId as string);

  return (
    <div className="mx-auto max-w-5xl">
      <PageHeader
        title={`แก้ไขออเดอร์ ${order.code}`}
        description="ปรับบริการ ห้องพัก หรือสินค้า แล้วยืนยันเพื่อสร้าง QR ใหม่ (นับเวลา 15 นาทีใหม่)"
      />
      <OrderForm
        mode="edit"
        orderId={order.id}
        services={services}
        rooms={rooms}
        products={products}
        preselected={{
          id: order.customer.id,
          name: order.customer.name,
          phone: order.customer.phone,
          pets: order.customer.pets.map((p) => ({
            id: p.id,
            name: p.name,
            species: p.species,
          })),
        }}
        initial={{
          petId: order.petId,
          serviceIds,
          roomId: order.roomId,
          nights: order.nights,
          productQty,
          note: order.note,
        }}
      />
    </div>
  );
}
