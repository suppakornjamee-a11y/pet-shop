import Link from "next/link";
import { notFound } from "next/navigation";
import {
  ArrowLeft,
  PawPrint,
  Pencil,
  CalendarClock,
  BedDouble,
  Syringe,
  Bug,
  UserCheck,
  Video,
  Smartphone,
} from "lucide-react";
import { prisma } from "@/lib/prisma";
import { allergyText } from "@/lib/pet-notes";
import { requireUser } from "@/lib/auth-helpers";
import { formatBaht, formatDateTime } from "@/lib/format";
import { getOrderKind, getMyGroomerPhase, getStatusBadgeInfo } from "@/lib/order-kind";
import { cn } from "@/lib/utils";
import { PageHeader } from "@/components/page-header";
import { SpeciesIcon } from "@/components/species-icon";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { PaymentPanel } from "@/components/payment-panel";
import { OrderStatusControl } from "@/components/order-status-control";
import { OrderStatusBadges } from "@/components/order-status-badges";
import { OrderExtraCharges } from "@/components/order-extra-charges";
import { AddOrderItemForm } from "@/components/add-order-item-form";
import { OrderItemsRows } from "@/components/order-items-rows";
import { getDictionary } from "@/i18n/get-dictionary";
import { getLocale } from "@/i18n/get-locale";

function PrintIcon({ className }: { className?: string }) {
  // eslint-disable-next-line @next/next/no-img-element
  return <img src="/images/icons/print.png" alt="" className={className} />;
}

export default async function OrderDetailPage(props: PageProps<"/orders/[id]">) {
  const user = await requireUser();
  const { id } = await props.params;

  const [order, services] = await Promise.all([
    prisma.order.findUnique({
      where: { id },
      include: {
        customer: true,
        pet: true,
        room: { include: { category: true } },
        items: { orderBy: { createdAt: "asc" } },
        payments: { orderBy: { createdAt: "asc" }, include: { bankAccount: true } },
        extraCharges: { orderBy: { createdAt: "desc" }, include: { createdBy: true } },
        activityLogs: { orderBy: { createdAt: "desc" }, include: { createdBy: true } },
      },
    }),
    prisma.service.findMany({ where: { active: true }, orderBy: { name: "asc" } }),
  ]);

  if (!order) notFound();

  const extraChargesTotal = order.extraCharges.reduce((sum, c) => sum + c.amount, 0);
  const isShopOrder = order.orderType === "SHOP";
  const verifiedSum = order.payments
    .filter((p) => p.status === "VERIFIED")
    .reduce((sum, p) => sum + p.amount, 0);
  // แก้ไข/เพิ่มรายการในออเดอร์ได้ตราบใดที่ยังไม่ยกเลิกและยอดคงเหลือ (รวมค่าเสียหายเพิ่มเติม) ยังไม่ชำระครบ
  const canEditItems =
    order.status !== "CANCELLED" && verifiedSum < order.total + extraChargesTotal;
  const isGroomer = user.role === "GROOMER";
  const orderKind = getOrderKind(order);
  const isFullyPaid = verifiedSum >= order.total + extraChargesTotal;
  const { startedNotFinished: iHaveStartedNotFinished } = getMyGroomerPhase(order.activityLogs, user.id);
  // badge สถานะแบบ personalize (ช่างที่ทำเสร็จแล้ว / รอลูกค้าชำระเงิน) — ใช้ฟังก์ชันเดียวกับหน้าปฏิทินคิว กันขึ้นไม่ตรงกัน
  const badgeInfo = getStatusBadgeInfo(order, user);
  const locale = await getLocale();
  const t = getDictionary(locale);
  // รายชื่อคนที่กด "เริ่มดำเนินการ" ไปแล้ว (ไม่ซ้ำ) — ใช้แสดงผลยืนยันให้ช่างเห็นว่าการกดมีผลจริง
  // (ต้องอยู่หลัง t เพราะเติมคำนำหน้า "ช่าง" จากไฟล์ภาษา)
  const activeWorkers = [
    ...new Set(
      order.activityLogs
        .filter((l) => l.action.endsWith("เริ่มดำเนินการ") && l.createdBy)
        .map((l) => `${t.orders.groomerPrefix}${l.createdBy!.name}`)
    ),
  ];
  const intlLocale = locale === "th" ? "th-TH" : "en-US";
  const backHref = order.roomId
    ? "/boarding"
    : order.queueType === "OTHER"
      ? "/orders/other"
      : "/orders/bath";

  return (
    <div className="mx-auto max-w-5xl">
      <PageHeader
        title={order.code}
        description={t.orders.detailCreatedAt(formatDateTime(order.createdAt))}
        action={
          <>
            <Button render={<Link href={backHref} />} nativeButton={false} variant="outline">
              <ArrowLeft /> {t.common.back}
            </Button>
            {/* หน้าแก้ไขออเดอร์เป็นฟอร์มลูกค้า+สัตว์เลี้ยง บิลร้านอาหารไม่มีข้อมูลพวกนี้ จึงไม่มีปุ่ม */}
            {!isShopOrder && order.status === "PENDING_PAYMENT" && !isGroomer && (
              <Button
                render={<Link href={`/orders/${order.id}/edit`} />}
                nativeButton={false}
                variant="outline"
              >
                <Pencil /> {t.orders.editOrder}
              </Button>
            )}
            {["PAID", "IN_PROGRESS", "COMPLETED"].includes(order.status) && (
              <Button
                render={<Link href={`/print/orders/${order.id}`} target="_blank" />}
                nativeButton={false}
                variant="outline"
              >
                <PrintIcon className="h-4 w-4" /> {t.orders.printDocument}
              </Button>
            )}
          </>
        }
      />

      <div className={cn("grid gap-6", !isGroomer && "lg:grid-cols-3")}>
        <div className={cn("space-y-6", !isGroomer && "lg:col-span-2")}>
          <Card>
            <CardHeader className="flex flex-wrap items-start justify-between gap-2">
              <div>
                <div className="flex flex-wrap items-center gap-1.5">
                  <CardTitle className="text-base">{t.orders.orderDetails}</CardTitle>
                  {order.createdVia === "LIFF" && (
                    <Badge variant="outline" className="gap-1 text-sky-700 dark:text-sky-400">
                      <Smartphone className="h-3 w-3" /> {t.orders.bookedViaLiff}
                    </Badge>
                  )}
                </div>
                {orderKind === "BATH" && activeWorkers.length > 0 && (
                  <p className="mt-1 text-xs text-muted-foreground">
                    {t.orders.activeWorkersLabel}:{" "}
                    <span className="font-medium text-foreground">{activeWorkers.join(", ")}</span>
                  </p>
                )}
                <div className="mt-1.5">
                  <OrderStatusBadges info={badgeInfo} t={t} />
                </div>
              </div>
              <OrderStatusControl
                isShopOrder={isShopOrder}
                orderId={order.id}
                status={order.status}
                role={user.role}
                orderKind={orderKind}
                isFullyPaid={isFullyPaid}
                roomLabel={order.room ? `${order.room.category.name} · ${order.room.name}` : null}
                iHaveStartedNotFinished={iHaveStartedNotFinished}
                badgeInfo={badgeInfo}
              />
            </CardHeader>
            <CardContent className="space-y-4">
              {order.appointmentAt && (
                <div className="flex items-center gap-2 rounded-lg bg-primary/10 px-3 py-2 text-sm font-medium text-primary">
                  <CalendarClock className="h-4 w-4" />
                  {t.orders.queueLabel(
                    new Intl.DateTimeFormat(intlLocale, {
                      dateStyle: "long",
                      timeStyle: "short",
                      timeZone: "Asia/Bangkok",
                    }).format(order.appointmentAt)
                  )}
                </div>
              )}

              {order.room && order.checkInAt && order.checkOutAt && (
                <div className="space-y-2 rounded-lg border bg-muted/30 p-3 text-sm">
                  <div className="flex items-center gap-2 font-medium">
                    <BedDouble className="h-4 w-4 text-primary" />
                    {order.room.category.name} · {order.room.name}
                    {order.nights > 0 && ` · ${t.orders.nightsLabel(order.nights)}`}
                  </div>
                  <div className="grid gap-1 text-xs text-muted-foreground sm:grid-cols-2">
                    <div>
                      {t.orders.checkIn}:{" "}
                      {new Intl.DateTimeFormat(intlLocale, {
                        dateStyle: "medium",
                        timeStyle: "short",
                        timeZone: "Asia/Bangkok",
                      }).format(order.checkInAt)}
                    </div>
                    <div>
                      {t.orders.checkOut}:{" "}
                      {new Intl.DateTimeFormat(intlLocale, {
                        dateStyle: "medium",
                        timeStyle: "short",
                        timeZone: "Asia/Bangkok",
                      }).format(order.checkOutAt)}
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-2 pt-1 text-xs">
                    {order.nannyType !== "NONE" && (
                      <Badge variant="secondary" className="gap-1">
                        <UserCheck className="h-3 w-3" />
                        {order.nannyType === "VIP" ? t.orders.nannyVipBadge : t.orders.nannyBadge}
                      </Badge>
                    )}
                    {order.cctvRequested && (
                      <Badge variant="secondary" className="gap-1">
                        <Video className="h-3 w-3" /> {t.orders.cctvBadge}
                      </Badge>
                    )}
                    <Badge variant={order.vaccineComplete ? "secondary" : "outline"} className="gap-1">
                      <Syringe className="h-3 w-3" />
                      {order.vaccineComplete ? t.orders.vaccineComplete : t.orders.vaccineIncomplete}
                    </Badge>
                    {order.fleaTickMedicine && (
                      <Badge variant="outline" className="gap-1">
                        <Bug className="h-3 w-3" />
                        {order.fleaTickMedicine}
                        {order.lastFleaTickAt &&
                          ` · ${new Intl.DateTimeFormat(intlLocale, { dateStyle: "medium", timeZone: "Asia/Bangkok" }).format(order.lastFleaTickAt)}`}
                      </Badge>
                    )}
                    {order.depositAmount > 0 && (
                      <Badge variant="outline">{t.orders.depositBadge(formatBaht(order.depositAmount))}</Badge>
                    )}
                  </div>
                </div>
              )}
              {/* บิลร้านอาหารเป็น walk-in ไม่ผูกลูกค้า/สัตว์เลี้ยง จึงไม่ต้องมีบล็อกนี้ */}
              {!isShopOrder && (
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <div className="text-sm font-bold">{t.orders.owner}</div>
                  <div className="text-xs">{order.customer?.name ?? "-"}</div>
                  <div className="text-xs text-muted-foreground">{order.customer?.phone}</div>
                </div>
                <div>
                  <div className="text-sm font-bold">{t.orders.pet}</div>
                  <div className="text-xs">
                    {order.pet ? (
                      <span className="inline-flex items-center gap-1.5">
                        <SpeciesIcon species={order.pet.species} className="h-4 w-4" /> {order.pet.name}
                        {allergyText(order.pet.allergies) && (
                          <span className="text-rose-600">({allergyText(order.pet.allergies)})</span>
                        )}
                      </span>
                    ) : (
                      "-"
                    )}
                  </div>
                </div>
              </div>
              )}

              <div className="overflow-hidden rounded-lg border">
                <table className="w-full text-sm">
                  <thead className="bg-muted/50 text-muted-foreground">
                    <tr>
                      <th className="px-3 py-2 text-left font-medium">{t.orders.columnItem}</th>
                      <th className="px-3 py-2 text-center font-medium">{t.orders.columnQty}</th>
                      <th className="px-3 py-2 text-right font-medium">{t.orders.columnPrice}</th>
                      <th className="px-3 py-2 text-right font-medium">{t.orders.columnSubtotal}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    <OrderItemsRows items={order.items} canEdit={canEditItems} />
                    {order.extraCharges.map((c) => (
                      <tr key={c.id} className="text-red-600">
                        <td className="px-3 py-2">
                          {c.description} ({t.orders.extraCharges.title})
                        </td>
                        <td className="px-3 py-2 text-center">1</td>
                        <td className="px-3 py-2 text-right">{formatBaht(c.amount)}</td>
                        <td className="px-3 py-2 text-right font-medium">
                          {formatBaht(c.amount)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot className="border-t bg-muted/30">
                    {order.holidaySurcharge > 0 && (
                      <tr>
                        <td colSpan={3} className="px-3 py-2 text-right font-semibold text-red-600">
                          {t.orders.holidaySurchargeLabel(order.holidayLabel ?? "")}
                        </td>
                        <td className="px-3 py-2 text-right font-bold text-red-600">
                          +{formatBaht(order.holidaySurcharge)}
                        </td>
                      </tr>
                    )}
                    <tr>
                      <td colSpan={3} className="px-3 py-2 text-right font-semibold">
                        {t.orders.grandTotal}
                      </td>
                      <td className="px-3 py-2 text-right text-base font-bold text-primary">
                        {formatBaht(order.total + extraChargesTotal)}
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>

              {order.note && (
                <div className="rounded-lg bg-muted/40 p-3 text-sm">
                  <span className="text-muted-foreground">{t.orders.noteLabel}</span>
                  {order.note}
                </div>
              )}
            </CardContent>
          </Card>

          {/* เพิ่มบริการเข้าออเดอร์ใช้กับงานบริการเท่านั้น บิลร้านอาหารเพิ่มของผ่านหน้าเมนู */}
          {!isShopOrder && (isGroomer || canEditItems) && order.status !== "CANCELLED" && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">{t.orders.addItem.title}</CardTitle>
              </CardHeader>
              <CardContent>
                <AddOrderItemForm
                  orderId={order.id}
                  services={services.filter(
                    (s) => !order.items.some((it) => it.refId === s.id)
                  )}
                />
              </CardContent>
            </Card>
          )}

          {/* ค่าเสียหายเพิ่มเติมใช้กับงานบริการ/ห้องพักเท่านั้น */}
          {!isShopOrder && (
          <OrderExtraCharges
            orderId={order.id}
            charges={order.extraCharges.map((c) => ({
              id: c.id,
              amount: c.amount,
              description: c.description,
              createdAt: c.createdAt.toISOString(),
              createdByName: c.createdBy?.name ?? null,
            }))}
            canEdit={canEditItems}
          />
          )}

          {order.activityLogs.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">{t.orders.activityLog.title}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {order.activityLogs.map((log) => {
                  const parenIndex = log.action.lastIndexOf(" (");
                  const title = parenIndex >= 0 ? log.action.slice(0, parenIndex) : log.action;
                  const amountText = parenIndex >= 0 ? log.action.slice(parenIndex) : "";
                  const titleColor = log.action.startsWith("เพิ่ม")
                    ? "text-emerald-600 dark:text-emerald-400"
                    : log.action.startsWith("ลบ")
                      ? "text-red-600 dark:text-red-400"
                      : log.action.startsWith("แก้ไข")
                        ? "text-amber-600 dark:text-amber-400"
                        : "";
                  return (
                    <div key={log.id} className="flex items-center justify-between text-sm">
                      <span>
                        <span className={titleColor}>{title}</span>
                        {amountText}
                      </span>
                      <span className="shrink-0 text-xs text-muted-foreground">
                        {log.createdBy?.name ?? "-"} · {formatDateTime(log.createdAt)}
                      </span>
                    </div>
                  );
                })}
              </CardContent>
            </Card>
          )}
        </div>

        {!isGroomer && (
          <div className="lg:col-span-1">
            {order.payments.length > 0 ? (
              <PaymentPanel
                orderId={order.id}
                orderStatus={order.status}
                orderTotal={order.total}
                extraChargesTotal={extraChargesTotal}
                isQueueBooking={Boolean(order.appointmentAt) && order.queueType !== "OTHER"}
                payments={order.payments.map((p) => ({
                  id: p.id,
                  purpose: p.purpose,
                  amount: p.amount,
                  status: p.status,
                  qrPayload: p.qrPayload,
                  expiresAt: p.expiresAt?.toISOString() ?? null,
                  slipUrl: p.slipUrl,
                  rejectReason: p.rejectReason,
                  bankAccount: p.bankAccount
                    ? {
                        bankName: p.bankAccount.bankName,
                        accountName: p.bankAccount.accountName,
                        accountNumber: p.bankAccount.accountNumber,
                      }
                    : null,
                }))}
              />
            ) : (
              <Card>
                <CardContent className="py-10 text-center text-sm text-muted-foreground">
                  <PawPrint className="mx-auto mb-2 h-8 w-8 opacity-40" />
                  {t.orders.noPaymentData}
                </CardContent>
              </Card>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
