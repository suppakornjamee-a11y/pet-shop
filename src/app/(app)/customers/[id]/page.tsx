import Link from "next/link";
import { notFound } from "next/navigation";
import {
  Phone,
  Mail,
  MapPin,
  MessageCircle,
  ClipboardPlus,
  Wallet,
  ReceiptText,
  CalendarClock,
  Plus,
  Pencil,
  History,
} from "lucide-react";
import { prisma } from "@/lib/prisma";
import { formatBaht, formatDate, formatDateTime } from "@/lib/format";
import { speciesEmoji, orderStatusColor, isFleaTickCheckStale } from "@/lib/labels";
import { cn } from "@/lib/utils";
import { PageHeader } from "@/components/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { PetFormDialog } from "@/components/pet-form-dialog";
import { LineConnectButton } from "@/components/line-connect-button";
import { buildLineLinkUrl } from "@/lib/line";
import { getDictionary } from "@/i18n/get-dictionary";
import { getLocale } from "@/i18n/get-locale";

export default async function CustomerDetailPage(props: PageProps<"/customers/[id]">) {
  const { id } = await props.params;

  const customer = await prisma.customer.findUnique({
    where: { id },
    include: {
      pets: { orderBy: { createdAt: "asc" } },
      orders: {
        orderBy: { createdAt: "desc" },
        include: { pet: true, items: true },
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
        title={customer.name}
        description={t.customers.customerSince(formatDate(customer.createdAt))}
        action={
          <>
            <Button
              render={<Link href={`/customers/${customer.id}/edit`} />}
              nativeButton={false}
              variant="outline"
            >
              <Pencil /> {t.customers.editInfo}
            </Button>
            <Button render={<Link href={`/calendar?customerId=${customer.id}`} />} nativeButton={false}>
              <ClipboardPlus /> {t.customers.bookOrder}
            </Button>
          </>
        }
      />

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

      {/* ===== Section 1: ข้อมูลเจ้าของ + สัตว์เลี้ยง ===== */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">{t.customers.ownerPetInfoTitle}</CardTitle>
          <div className="mt-1 flex items-center gap-1 text-xs text-muted-foreground">
            <History className="h-3 w-3" /> {t.customers.lastEdited(formatDateTime(customer.updatedAt))}
          </div>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="grid gap-3 text-sm sm:grid-cols-2">
            <div className="flex items-center gap-2">
              <Phone className="h-4 w-4 text-muted-foreground" /> {customer.phone}
            </div>
            {customer.email && (
              <div className="flex items-center gap-2">
                <Mail className="h-4 w-4 text-muted-foreground" /> {customer.email}
              </div>
            )}
            {customer.lineId && (
              <div className="flex items-center gap-2">
                <MessageCircle className="h-4 w-4 text-muted-foreground" /> {customer.lineId}
              </div>
            )}
            {customer.address && (
              <div className="flex items-center gap-2 sm:col-span-2">
                <MapPin className="h-4 w-4 shrink-0 text-muted-foreground" /> {customer.address}
              </div>
            )}
          </div>

          <LineConnectButton linked={!!customer.lineUserId} linkUrl={buildLineLinkUrl(customer.id)} />

          <div className="flex items-center justify-between">
            <div className="text-sm font-medium text-muted-foreground">
              {t.customers.petsCountLabel(customer.pets.length)}
            </div>
            <PetFormDialog
              customerId={customer.id}
              trigger={
                <Button variant="outline" size="sm">
                  <Plus /> {t.customers.addPet}
                </Button>
              }
            />
          </div>

          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {customer.pets.map((pet) => (
              <div key={pet.id} className="rounded-xl border p-4">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <span className="text-2xl">{speciesEmoji[pet.species]}</span>
                    <div>
                      <div className="font-semibold">{pet.name}</div>
                      <div className="text-xs text-muted-foreground">
                        {t.labels.species[pet.species]} · {t.labels.gender[pet.gender]}
                      </div>
                    </div>
                  </div>
                  <Button
                    render={<Link href={`/customers/${customer.id}/edit`} />}
                    nativeButton={false}
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7 shrink-0"
                  >
                    <Pencil className="h-3.5 w-3.5" />
                  </Button>
                </div>
                <div className="mt-3 space-y-1 text-xs text-muted-foreground">
                  {pet.breed && <div>{t.customers.breedLabel(pet.breed)}</div>}
                  {pet.color && <div>{t.customers.colorLabel(pet.color)}</div>}
                  {pet.weightKg != null && <div>{t.customers.weightLabel(pet.weightKg)}</div>}
                </div>
                {pet.allergies && (
                  <div className="mt-2 rounded-md bg-rose-50 px-2 py-1 text-xs font-medium text-rose-700 dark:bg-rose-950/40 dark:text-rose-400">
                    {t.customers.allergyWarning(pet.allergies)}
                  </div>
                )}
                <div
                  className={cn(
                    "mt-2 rounded-md px-2 py-1 text-xs font-medium",
                    isFleaTickCheckStale(pet.lastFleaTickAt)
                      ? "bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-400"
                      : "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400"
                  )}
                >
                  {pet.lastFleaTickAt
                    ? t.customers.fleaTickLastChecked(formatDate(pet.lastFleaTickAt))
                    : t.customers.fleaTickNeverChecked}
                </div>
                <div className="mt-2 flex items-center gap-1 text-[10px] text-muted-foreground/70">
                  <History className="h-2.5 w-2.5" /> {t.customers.editedLabel(formatDateTime(pet.updatedAt))}
                </div>
              </div>
            ))}
            {customer.pets.length === 0 && (
              <p className="text-sm text-muted-foreground">{t.customers.noPets}</p>
            )}
          </div>
        </CardContent>
      </Card>

      {/* ===== Section 2: สรุปการใช้บริการ ===== */}
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

      {/* ===== Section 3: ประวัติการใช้บริการ ===== */}
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
                      <Badge
                        variant="outline"
                        className={cn("text-[10px]", orderStatusColor[o.status])}
                      >
                        {t.labels.orderStatus[o.status]}
                      </Badge>
                    </div>
                    <div className="truncate text-xs text-muted-foreground">
                      {o.pet ? `${speciesEmoji[o.pet.species]} ${o.pet.name} · ` : ""}
                      {o.items.map((i) => i.name).join(", ")}
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
    </div>
  );
}
