import { prisma } from "@/lib/prisma";
import { formatBaht } from "@/lib/format";
import { PageHeader } from "@/components/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { getDictionary } from "@/i18n/get-dictionary";
import { getLocale } from "@/i18n/get-locale";

function ProductGrid({
  products,
  empty,
}: {
  products: { id: string; name: string; category: string | null; price: number; unit: string; stockQty: number }[];
  empty: string;
}) {
  if (products.length === 0) {
    return <p className="text-sm text-muted-foreground">{empty}</p>;
  }
  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {products.map((p) => (
        <Card key={p.id}>
          <CardContent className="space-y-1.5 py-2">
            <div className="flex items-start justify-between gap-2">
              <div className="font-medium">{p.name}</div>
              <span className="shrink-0 font-medium">{formatBaht(p.price)}</span>
            </div>
            <div className="flex flex-wrap items-center gap-1.5">
              {p.category && (
                <Badge variant="secondary" className="text-[10px]">
                  {p.category}
                </Badge>
              )}
              <Badge variant="outline" className="text-[10px]">
                {p.stockQty} {p.unit}
              </Badge>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

export default async function ShopPage() {
  const products = await prisma.product.findMany({
    where: { active: true },
    orderBy: { name: "asc" },
  });
  const t = getDictionary(await getLocale());
  const petProducts = products.filter((p) => p.target === "PET");
  const humanProducts = products.filter((p) => p.target === "HUMAN");

  return (
    <div className="mx-auto max-w-5xl">
      <PageHeader title={t.shop.title} description={t.shop.description} />

      <Tabs defaultValue="shop">
        <TabsList>
          <TabsTrigger value="shop">{t.shop.tabShop}</TabsTrigger>
          <TabsTrigger value="cafe">{t.shop.tabCafe}</TabsTrigger>
        </TabsList>
        <TabsContent value="shop" className="mt-4">
          <ProductGrid products={petProducts} empty={t.shop.empty} />
        </TabsContent>
        <TabsContent value="cafe" className="mt-4">
          <ProductGrid products={humanProducts} empty={t.shop.empty} />
        </TabsContent>
      </Tabs>

      <p className="mt-4 text-xs text-muted-foreground">{t.shop.manageHint}</p>
    </div>
  );
}
