import { prisma } from "@/lib/prisma";
import { PageHeader } from "@/components/page-header";
import { ServiceManager } from "@/components/settings/service-manager";
import { getDictionary } from "@/i18n/get-dictionary";
import { getLocale } from "@/i18n/get-locale";

export default async function ServicesSettingsPage() {
  const services = await prisma.service.findMany({
    orderBy: [{ category: "asc" }, { sortOrder: "asc" }, { name: "asc" }],
  });
  const t = getDictionary(await getLocale());

  return (
    <div className="mx-auto max-w-5xl">
      <PageHeader title={t.settings.services.title} description={t.settings.services.description} />
      <ServiceManager services={services} />
    </div>
  );
}
