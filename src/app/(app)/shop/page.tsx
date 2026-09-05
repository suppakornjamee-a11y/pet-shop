import { prisma } from "@/lib/prisma";
import { PageHeader } from "@/components/page-header";
import { ShopMenu } from "@/components/shop-menu";
import { getDictionary } from "@/i18n/get-dictionary";
import { getLocale } from "@/i18n/get-locale";
import { requireStaffUser } from "@/lib/auth-helpers";

export default async function ShopPage() {
  await requireStaffUser();
  const products = await prisma.product.findMany({
    where: { active: true },
    orderBy: { name: "asc" },
  });
  const t = getDictionary(await getLocale());

  const toMenuItem = (p: (typeof products)[number]) => ({
    id: p.id,
    name: p.name,
    category: p.category,
    price: p.price,
    unit: p.unit,
    stockQty: p.stockQty,
    imageUrl: p.imageUrl,
  });

  return (
    <div className="mx-auto max-w-5xl">
      <PageHeader title={t.shop.title} />
      <ShopMenu
        humanProducts={products.filter((p) => p.target === "HUMAN").map(toMenuItem)}
        petProducts={products.filter((p) => p.target === "PET").map(toMenuItem)}
      />
    </div>
  );
}
