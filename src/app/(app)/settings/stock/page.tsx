import { prisma } from "@/lib/prisma";
import { PageHeader } from "@/components/page-header";
import { StockManager } from "@/components/settings/stock-manager";
import { ProductImportExport } from "@/components/product-import-export";
import { getDictionary } from "@/i18n/get-dictionary";
import { getLocale } from "@/i18n/get-locale";
import { requireStaffUser } from "@/lib/auth-helpers";

export default async function StockSettingsPage() {
  await requireStaffUser();
  const products = await prisma.product.findMany({ orderBy: { createdAt: "desc" } });
  const t = getDictionary(await getLocale());
  return (
    <div className="mx-auto max-w-5xl">
      <PageHeader
        title={t.settings.stock.title}
        action={<ProductImportExport />}
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
          imageUrl: p.imageUrl,
          active: p.active,
        }))}
      />
    </div>
  );
}
