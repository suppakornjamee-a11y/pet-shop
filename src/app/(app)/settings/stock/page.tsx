import { prisma } from "@/lib/prisma";
import { PageHeader } from "@/components/page-header";
import { StockManager } from "@/components/settings/stock-manager";

export default async function StockSettingsPage() {
  const products = await prisma.product.findMany({ orderBy: { createdAt: "desc" } });
  return (
    <div className="mx-auto max-w-5xl">
      <PageHeader
        title="สินค้า / สต็อก"
        description="จัดการสินค้าของสัตว์ (ขนม อาหารเปียก ฯลฯ) และจำนวนคงเหลือ"
      />
      <StockManager
        products={products.map((p) => ({
          id: p.id,
          name: p.name,
          target: p.target,
          category: p.category,
          price: p.price,
          cost: p.cost,
          unit: p.unit,
          stockQty: p.stockQty,
          active: p.active,
        }))}
      />
    </div>
  );
}
