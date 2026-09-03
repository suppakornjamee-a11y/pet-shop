import Link from "next/link";
import { notFound } from "next/navigation";
import { Wallet, ReceiptText, CalendarClock, Pencil, History, Smartphone } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { formatBaht, formatDate, formatDateTime } from "@/lib/format";
import { isFleaTickCheckStale } from "@/lib/labels";
import { getStatusBadgeInfo } from "@/lib/order-kind";
import { toThaiDateStr } from "@/lib/slots";
import { PageHeader } from "@/components/page-header";
import { SpeciesIcon } from "@/components/species-icon";
import { OrderStatusBadges } from "@/components/order-status-badges";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { RegisterForm } from "@/components/register-form";
// import { LineConnectButton } from "@/components/line-connect-button"; -- ปุ่มเชื่อมต่อ LINE คอมเม้นปิดไว้ก่อน ดูจุดใช้งานด้านล่าง
// import { buildLineLinkUrl } from "@/lib/line";
import { getDictionary } from "@/i18n/get-dictionary";
import { getLocale } from "@/i18n/get-locale";
import { requireStaffUser } from "@/lib/auth-helpers";

export default async function CustomerDetailPage(props: PageProps<"/customers/[id]">) {
  const user = await requireStaffUser();
  const { id } = await props.params;

  const customer = await prisma.customer.findUnique({
    where: { id },
    include: {
      pets: { orderBy: { createdAt: "asc" } },
      orders: {
        orderBy: { createdAt: "desc" },
        include: {
          pet: true,
          items: true,
          payments: { select: { status: true, amount: true } },
          extraCharges: { select: { amount: true } },
          activityLogs: { select: { action: true, createdById: true } },
        },
      },
    },
  });

  if (!customer) notFound();

  const paidOrders = customer.orders.filter((o) =>
    ["PAID", "IN_PROGRESS", "COMPLETED"].includes(o.status)
  );
  const totalSpent = paidOrders.reduce((sum, o) => sum + o.total, 0);
  // นับ "ครั้งที่ใช้บริการ" เฉพาะออเดอร์ที่เสร็จสิ้นแล้ว
  const completedOrders = customer.orders.filter((o) => o.status === "COMPLETED");
  const visitCount = completedOrders.length;
  const lastVisit = completedOrders[0]?.createdAt;
  const t = getDictionary(await getLocale());

  // เตือนตรวจเห็บ/หมัดก่อนจอง
  const petsNeedingFleaCheck = customer.pets.filter((pet) => isFleaTickCheckStale(pet.lastFleaTickAt));

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <PageHeader
        title={t.customers.customerNameWithTitle(customer.name)}
        description={t.customers.customerSince(formatDate(customer.createdAt))}
        action={
          <Button
            render={<Link href={`/customers/${customer.id}/edit`} />}
            nativeButton={false}
            variant="outline"
          >
            <Pencil /> {t.customers.editInfo}
          </Button>
        }
      />

      <div className="space-y-2">
        <div className="flex items-center gap-1 text-xs text-muted-foreground">
          <History className="h-3 w-3" /> {t.customers.lastEdited(formatDateTime(customer.updatedAt))}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {/* คอมเม้นปิดไว้ก่อนตามคำขอ — ตอนนี้ลูกค้าผูกบัญชี LINE เองผ่าน LIFF แล้ว ปุ่มนี้ทำให้สับสน
              เปิดกลับมาใช้ได้ทีหลังถ้าต้องการ (เช่น กรณีลูกค้าเก่าที่ยังไม่เคยผูกผ่าน LIFF)
          <LineConnectButton linked={!!customer.lineUserId} linkUrl={buildLineLinkUrl(customer.id)} />
          */}
          {customer.createdVia === "LIFF" && (
            <Badge variant="outline" className="gap-1 text-sky-700 dark:text-sky-400">
              <Smartphone className="h-3 w-3" /> {t.customers.registeredViaLiff}
            </Badge>
          )}
        </div>
      </div>

      {petsNeedingFleaCheck.length > 0 && (
        <div className="rounded-lg border-2 border-amber-500 bg-amber-50 p-3 text-sm dark:bg-amber-950/30">
          <div className="font-bold text-amber-700 dark:text-amber-400">
            {t.customers.fleaTickReminderTitle}
          </div>
          <div className="mt-0.5 text-amber-700/90 dark:text-amber-400/90">
            {t.customers.fleaTickReminderPets(petsNeedingFleaCheck.map((p) => p.name).join(", "))}
          </div>
        </div>
      )}

      {/* ===== ข้อมูลเจ้าของ + สัตว์เลี้ยงแบบละเอียด (เหมือนหน้าลงทะเบียน) แบบดูอย่างเดียว ===== */}
      <RegisterForm
        mode="view"
        initialCustomer={{
          name: customer.name,
          nickname: customer.nickname ?? "",
          phone: customer.phone,
          email: customer.email ?? "",
          lineId: customer.lineId ?? "",
          address: customer.address ?? "",
          petInstagram: customer.petInstagram ?? "",
          preferredLanguage: customer.preferredLanguage,
          note: customer.note ?? "",
        }}
        initialPets={customer.pets.map((p) => ({
          id: p.id,
          name: p.name,
          species: p.species,
          breed: p.breed ?? "",
          gender: p.gender,
          birthDate: p.birthDate ? toThaiDateStr(p.birthDate) : "",
          weightKg: p.weightKg != null ? String(p.weightKg) : "",
          color: p.color ?? "",
          personality: p.personality ?? "",
          aggressiveNotes: p.aggressiveNotes ?? "",
          allergies: p.allergies ?? "",
          vaccine5in1Date: p.vaccine5in1At ? toThaiDateStr(p.vaccine5in1At) : "",
          rabiesVaccineDate: p.rabiesVaccineAt ? toThaiDateStr(p.rabiesVaccineAt) : "",
          lastFleaTickDate: p.lastFleaTickAt ? toThaiDateStr(p.lastFleaTickAt) : "",
          fleaTickMedicine: p.fleaTickMedicine ?? "",
          foodNote: p.foodNote ?? "",
          medicationNote: p.medicationNote ?? "",
          neutered: p.neutered,
          note: p.note ?? "",
          photoUrls: p.photoUrls,
          vaccinePhotoUrls: p.vaccinePhotoUrls,
          vaccineComplete: p.vaccineComplete ?? false,
        }))}
        footer={
          <>
            {/* ===== สรุปการใช้บริการ ===== */}
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
              <Card>
                <CardContent className="flex items-center gap-3 py-2">
                  <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-emerald-100 text-emerald-600 dark:bg-emerald-950">
                    <Wallet className="h-5 w-5" />
                  </div>
                  <div>
                    <div className="text-lg font-bold">{formatBaht(totalSpent)}</div>
                    <div className="text-xs text-muted-foreground">{t.customers.totalSpent}</div>
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="flex items-center gap-3 py-2">
                  <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-sky-100 text-sky-600 dark:bg-sky-950">
                    <ReceiptText className="h-5 w-5" />
                  </div>
                  <div>
                    <div className="text-lg font-bold">{visitCount}</div>
                    <div className="text-xs text-muted-foreground">{t.customers.visitCountLabel}</div>
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="flex items-center gap-3 py-2">
                  <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-violet-100 text-violet-600 dark:bg-violet-950">
                    <CalendarClock className="h-5 w-5" />
                  </div>
                  <div>
                    <div className="text-lg font-bold">
                      {lastVisit ? formatDate(lastVisit) : "-"}
                    </div>
                    <div className="text-xs text-muted-foreground">{t.customers.lastVisit}</div>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* ===== ประวัติการใช้บริการ ===== */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base">{t.customers.serviceHistoryTitle}</CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                {customer.orders.length === 0 ? (
                  <div className="py-12 text-center text-sm text-muted-foreground">
                    {t.customers.noServiceHistory}
                  </div>
                ) : (
                  <div className="divide-y">
                    {customer.orders.map((o) => (
                      <Link
                        key={o.id}
                        href={`/orders/${o.id}`}
                        className="flex items-center justify-between gap-3 p-4 transition-colors hover:bg-accent/50"
                      >
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="font-medium">{o.code}</span>
                            <OrderStatusBadges info={getStatusBadgeInfo(o, user)} t={t} size="xs" />
                          </div>
                          <div className="flex items-center gap-1 truncate text-xs text-muted-foreground">
                            {o.pet && <SpeciesIcon species={o.pet.species} className="h-3.5 w-3.5 shrink-0" />}
                            <span className="truncate">
                              {o.pet ? `${o.pet.name} · ` : ""}
                              {o.items.map((i) => i.name).join(", ")}
                            </span>
                          </div>
                          <div className="text-xs text-muted-foreground">
                            {formatDateTime(o.createdAt)}
                          </div>
                        </div>
                        <div className="shrink-0 font-semibold">{formatBaht(o.total)}</div>
                      </Link>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </>
        }
      />
    </div>
  );
}
