import { requireAdmin } from "@/lib/auth-helpers";
import { prisma } from "@/lib/prisma";
import { PageHeader } from "@/components/page-header";
import { HolidayManager } from "@/components/settings/holiday-manager";
import { toThaiDateStr } from "@/lib/slots";
import { getDictionary } from "@/i18n/get-dictionary";
import { getLocale } from "@/i18n/get-locale";

export default async function HolidaysSettingsPage() {
  await requireAdmin();
  const holidays = await prisma.holiday.findMany({ orderBy: { date: "asc" } });
  const t = getDictionary(await getLocale());

  return (
    <div className="mx-auto max-w-4xl">
      <PageHeader
        title={t.settings.holidays.title}
        description={t.settings.holidays.description}
      />
      <HolidayManager
        holidays={holidays.map((h) => ({
          id: h.id,
          date: toThaiDateStr(h.date),
          title: h.title,
          extraCharge: h.extraCharge,
        }))}
      />
    </div>
  );
}
