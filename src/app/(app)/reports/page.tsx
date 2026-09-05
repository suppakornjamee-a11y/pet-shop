import { BarChart3 } from "lucide-react";
import { requireAdmin } from "@/lib/auth-helpers";
import { PageHeader } from "@/components/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { getDictionary } from "@/i18n/get-dictionary";
import { getLocale } from "@/i18n/get-locale";

// หน้ารายงาน — ตอนนี้ทำโครงไว้ก่อน ยังไม่มีเนื้อหาข้างใน
export default async function ReportsPage() {
  await requireAdmin();
  const t = getDictionary(await getLocale());

  return (
    <div>
      <PageHeader title={t.reports.title} description={t.reports.description} />

      <Card>
        <CardContent className="flex flex-col items-center gap-3 py-20 text-center">
          <BarChart3 className="h-10 w-10 text-muted-foreground/40" />
          <p className="text-sm text-muted-foreground">{t.reports.comingSoon}</p>
        </CardContent>
      </Card>
    </div>
  );
}
