import { requireAdmin } from "@/lib/auth-helpers";
import { getShopInfo } from "@/lib/settings";
import { PageHeader } from "@/components/page-header";
import { ShopInfoForm } from "@/components/settings/shop-info-form";
import { getDictionary } from "@/i18n/get-dictionary";
import { getLocale } from "@/i18n/get-locale";

export default async function ShopInfoSettingsPage() {
  await requireAdmin();
  const shopInfo = await getShopInfo();
  const t = getDictionary(await getLocale());

  return (
    <div className="mx-auto max-w-4xl">
      <PageHeader title={t.settings.shopInfo.title} description={t.settings.shopInfo.description} />
      <ShopInfoForm shopInfo={shopInfo} />
    </div>
  );
}
