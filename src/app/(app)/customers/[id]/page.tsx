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
import {
  speciesLabel,
  speciesEmoji,
  genderLabel,
  orderStatusLabel,
  orderStatusColor,
} from "@/lib/labels";
import { cn } from "@/lib/utils";
import { PageHeader } from "@/components/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { PetFormDialog } from "@/components/pet-form-dialog";
import { EditCustomerDialog } from "@/components/edit-customer-dialog";

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

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <PageHeader
        title={customer.name}
        description={`ลูกค้าตั้งแต่ ${formatDate(customer.createdAt)}`}
        action={
          <>
            <EditCustomerDialog
              customer={{
                id: customer.id,
                name: customer.name,
                phone: customer.phone,
                email: customer.email,
                address: customer.address,
                lineId: customer.lineId,
                note: customer.note,
              }}
            />
            <Button render={<Link href={`/calendar?customerId=${customer.id}`} />} nativeButton={false}>
              <ClipboardPlus /> จองคิว / สร้างออเดอร์
            </Button>
          </>
        }
      />

      {/* ===== Section 1: ข้อมูลเจ้าของ + สัตว์เลี้ยง ===== */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">ข้อมูลเจ้าของ &amp; สัตว์เลี้ยง</CardTitle>
          <div className="mt-1 flex items-center gap-1 text-xs text-muted-foreground">
            <History className="h-3 w-3" /> แก้ไขล่าสุด {formatDateTime(customer.updatedAt)}
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

          <div className="flex items-center justify-between">
            <div className="text-sm font-medium text-muted-foreground">
              สัตว์เลี้ยง ({customer.pets.length})
            </div>
            <PetFormDialog
              customerId={customer.id}
              trigger={
                <Button variant="outline" size="sm">
                  <Plus /> เพิ่มสัตว์เลี้ยง
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
                        {speciesLabel[pet.species]} · {genderLabel[pet.gender]}
                      </div>
                    </div>
                  </div>
                  <PetFormDialog
                    customerId={customer.id}
                    pet={{
                      id: pet.id,
                      name: pet.name,
                      species: pet.species,
                      gender: pet.gender,
                      breed: pet.breed,
                      color: pet.color,
                      weightKg: pet.weightKg,
                      allergies: pet.allergies,
                      note: pet.note,
                    }}
                    trigger={
                      <Button variant="ghost" size="icon" className="h-7 w-7 shrink-0">
                        <Pencil className="h-3.5 w-3.5" />
                      </Button>
                    }
                  />
                </div>
                <div className="mt-3 space-y-1 text-xs text-muted-foreground">
                  {pet.breed && <div>สายพันธุ์: {pet.breed}</div>}
                  {pet.color && <div>สี: {pet.color}</div>}
                  {pet.weightKg != null && <div>น้ำหนัก: {pet.weightKg} กก.</div>}
                </div>
                {pet.allergies && (
                  <div className="mt-2 rounded-md bg-rose-50 px-2 py-1 text-xs font-medium text-rose-700 dark:bg-rose-950/40 dark:text-rose-400">
                    ⚠️ แพ้: {pet.allergies}
                  </div>
                )}
                <div className="mt-2 flex items-center gap-1 text-[10px] text-muted-foreground/70">
                  <History className="h-2.5 w-2.5" /> แก้ไข {formatDateTime(pet.updatedAt)}
                </div>
              </div>
            ))}
            {customer.pets.length === 0 && (
              <p className="text-sm text-muted-foreground">ยังไม่มีสัตว์เลี้ยง</p>
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
              <div className="text-xs text-muted-foreground">ยอดใช้จ่ายสะสม</div>
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
              <div className="text-xs text-muted-foreground">ครั้งที่ใช้บริการ (เสร็จสิ้น)</div>
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
              <div className="text-xs text-muted-foreground">มาล่าสุด</div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* ===== Section 3: ประวัติการใช้บริการ ===== */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">ประวัติการใช้บริการ</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {customer.orders.length === 0 ? (
            <div className="py-12 text-center text-sm text-muted-foreground">
              ยังไม่มีประวัติการใช้บริการ
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
                        {orderStatusLabel[o.status]}
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
