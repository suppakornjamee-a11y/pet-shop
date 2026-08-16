import { prisma } from "@/lib/prisma";
import { PageHeader } from "@/components/page-header";
import { StockManager } from "@/components/settings/stock-manager";
import { getDictionary } from "@/i18n/get-dictionary";
import { getLocale } from "@/i18n/get-locale";

export default async function StockSettingsPage() {
  const products = await prisma.product.findMany({ orderBy: { createdAt: "desc" } });
  const t = getDictionary(await getLocale());
  return (
    <div className="mx-auto max-w-5xl">
      <PageHeader
        title={t.settings.stock.title}
        description={t.settings.stock.description}
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
