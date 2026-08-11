import { prisma } from "@/lib/prisma";
import { PageHeader } from "@/components/page-header";
import { OrderForm } from "@/components/order-form";

export default async function NewOrderPage(props: PageProps<"/orders/new">) {
  const searchParams = await props.searchParams;
  const customerId =
    typeof searchParams.customerId === "string" ? searchParams.customerId : undefined;

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

  return (
    <div className="mx-auto max-w-5xl">
      <PageHeader
        title="สร้างออเดอร์"
        description="เลือกลูกค้า บริการ ห้องพัก และสินค้า แล้วสร้าง QR ให้ลูกค้าชำระเงิน"
      />
      <OrderForm
        services={services}
        rooms={rooms}
        products={products}
        preselected={preselected}
      />
    </div>
  );
}
