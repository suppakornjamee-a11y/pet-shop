import Link from "next/link";
import { notFound } from "next/navigation";
import {
  ArrowLeft,
  BedDouble,
  Bug,
  CalendarClock,
  PawPrint,
  Pencil,
  ReceiptText,
  Scissors,
  Syringe,
  UserCheck,
  UserRound,
  Video,
} from "lucide-react";
import { prisma } from "@/lib/prisma";
import { allergyText } from "@/lib/pet-notes";
import { requireUser } from "@/lib/auth-helpers";
import { formatBaht, formatDateTime } from "@/lib/format";
import { getOrderKind, getMyGroomerPhase, getStatusBadgeInfo, isBeforeServiceDay } from "@/lib/order-kind";
import { cn } from "@/lib/utils";
import { PageHeader } from "@/components/page-header";
import { SpeciesIcon } from "@/components/species-icon";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { PaymentPanel } from "@/components/payment-panel";
import { OrderStatusControl } from "@/components/order-status-control";
import { DetailSection } from "@/components/order-detail-section";
import { CustomerPreviewButton } from "@/components/customer-preview-dialog";
import { FleaTickStatusBlock } from "@/components/flea-tick-status";
import { VerifySeal } from "@/components/verify-seal";
import { computeFleaTickStatus } from "@/lib/flea-tick";
import { BookingRequestPanel, type BookingRequestView } from "@/components/booking-request-panel";
import { amountDueNow } from "@/lib/booking-request";
import { toThaiDateStr } from "@/lib/slots";
import { OrderStatusBadges } from "@/components/order-status-badges";
import { OrderExtraCharges } from "@/components/order-extra-charges";
import { AddOrderItemForm } from "@/components/add-order-item-form";
import { OrderItemsRows } from "@/components/order-items-rows";
import { StyleImagesViewer } from "@/components/style-images-viewer";
import { FleaCheckPanel } from "@/components/flea-check-panel";
import { FLEA_STAFF_CHECKED_LOG, parseFleaCheckLog } from "@/lib/order-log";
import { getDictionary } from "@/i18n/get-dictionary";
import { getLocale } from "@/i18n/get-locale";

/** ไอคอนใบเสร็จ — ต้นฉบับเป็นเส้นสีเข้มสีเดียว ถ้าวางเป็น <img> ตรงๆ จะจมหายไปในธีมมืด
 *  จึงใช้เป็น mask แล้วเทสีตามสีตัวหนังสือของปุ่ม ทำให้เห็นชัดทั้งสองธีม */
function PrintIcon({ className }: { className?: string }) {
  return (
    <span
      aria-hidden
      className={cn("inline-block shrink-0 bg-current", className)}
      style={{
        maskImage: "url(/images/icons/receipt.png)",
        WebkitMaskImage: "url(/images/icons/receipt.png)",
        maskSize: "contain",
        WebkitMaskSize: "contain",
        maskRepeat: "no-repeat",
        WebkitMaskRepeat: "no-repeat",
        maskPosition: "center",
        WebkitMaskPosition: "center",
      }}
    />
  );
}

export default async function OrderDetailPage(props: PageProps<"/orders/[id]">) {
  const user = await requireUser();
  const { id } = await props.params;

  const [order, services] = await Promise.all([
    prisma.order.findUnique({
      where: { id },
      include: {
        customer: true,
        pet: { include: { fleaTickProduct: true } },
        room: { include: { category: true } },
        items: { orderBy: { createdAt: "asc" } },
        payments: { orderBy: { createdAt: "asc" }, include: { bankAccount: true } },
        extraCharges: { orderBy: { createdAt: "desc" }, include: { createdBy: true } },
        activityLogs: { orderBy: { createdAt: "desc" }, include: { createdBy: true } },
        bookingRequest: {
          include: {
            orders: {
              orderBy: { createdAt: "asc" },
              select: {
                id: true,
                code: true,
                status: true,
                total: true,
                depositAmount: true,
                appointmentAt: true,
                checkInAt: true,
                checkOutAt: true,
                pet: { select: { name: true, species: true } },
                room: { select: { name: true, category: { select: { name: true } } } },
                items: { orderBy: { createdAt: "asc" }, select: { name: true } },
              },
            },
          },
        },
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
  // คำขอจองจาก LINE ที่ออเดอร์นี้อยู่ — แสดงทุกรายการในคำขอ (อนุมัติคิวทีละรายการด้วยปุ่มของออเดอร์)
  const requestView: BookingRequestView | null = order.bookingRequest
    ? (() => {
        const live = order.bookingRequest.orders.filter((o) => o.status !== "CANCELLED");
        return {
          id: order.bookingRequest.id,
          code: order.bookingRequest.code,
          status: order.bookingRequest.status,
          rescheduleReason: order.bookingRequest.rescheduleReason,
          totalEstimate: live.reduce((s, o) => s + o.total, 0),
          dueNow: live.reduce((s, o) => s + amountDueNow(o), 0),
          items: order.bookingRequest.orders.map((o) => ({
            orderId: o.id,
            orderCode: o.code,
            isCurrent: o.id === order.id,
            petName: o.pet?.name ?? null,
            species: o.pet?.species ?? null,
            summary: [o.room ? `${o.room.category.name} · ${o.room.name}` : null, ...o.items.map((i) => i.name)]
              .filter(Boolean)
              .join(" · "),
            when: o.appointmentAt
              ? formatDateTime(o.appointmentAt)
              : o.checkInAt
                ? `${formatDateTime(o.checkInAt)}${o.checkOutAt ? ` – ${formatDateTime(o.checkOutAt)}` : ""}`
                : "-",
            total: o.total,
            dueNow: amountDueNow(o),
            cancelled: o.status === "CANCELLED",
            status: o.status,
          })),
        };
      })()
    : null;
  // ผลตรวจยาเห็บหมัดที่ระบบสรุปไว้ตอนลูกค้าจอง (ประวัติเรียงใหม่สุดก่อน จึงเจอรายการล่าสุดก่อน)
  const fleaCheck = order.activityLogs.map((l) => parseFleaCheckLog(l.action)).find((c) => c !== null) ?? null;
  const fleaStaffChecked = order.activityLogs.some((l) => l.action === FLEA_STAFF_CHECKED_LOG);
  // ส่วน "ยาเห็บหมัด" แสดงเมื่อมีอะไรให้โชว์จริง: บล็อกสถานะยา (มีข้อมูลยา หรือรอเช็คคิวของงานคิว) และ/หรือผลตรวจตอนจอง
  const fleaAlwaysShow = order.status === "PENDING_APPROVAL" && !order.roomId;
  const fleaStatusShown =
    !!order.pet && (!!(order.pet.lastFleaTickAt || order.pet.fleaTickMedicine || order.pet.fleaTickProduct) || fleaAlwaysShow);
  const showFleaSection = fleaStatusShown || !!fleaCheck;
  // ตราไอคอนยืนยันที่หัวข้อ "ยาเห็บหมัด" — ขึ้นเมื่อสถานะยาของสัตว์ตัวนี้ครอบคลุมถึงวันบริการ (ข้อความเดียวกับป้าย "ผ่านการตรวจสอบ")
  const fleaPassed =
    !!order.pet &&
    computeFleaTickStatus({
      givenAt: order.pet.lastFleaTickAt,
      product: order.pet.fleaTickProduct,
      petSpecies: order.pet.species,
      serviceDate: toThaiDateStr(order.appointmentAt ?? order.checkInAt ?? new Date()),
    }).kind === "COVERED";
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
            {!isShopOrder &&
              (order.status === "PENDING_PAYMENT" || order.status === "PENDING_APPROVAL") &&
              !isGroomer && (
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

      <div className={cn("grid gap-6", !isGroomer && "xl:grid-cols-3")}>
        <div className={cn("space-y-6", !isGroomer && "lg:col-span-2")}>
          {requestView && <BookingRequestPanel request={requestView} canManage={!isGroomer} />}
          <Card>
            <CardHeader>
              {/* ชื่อ + ป้ายสถานะอยู่ซ้าย ปุ่มดำเนินการชิดขวาในแถวเดียวกัน · จอแคบ: ปุ่มลงมาอยู่ใต้ชื่อ ชิดซ้าย */}
              <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
                <div className="flex flex-wrap items-center gap-2">
                  <CardTitle className="whitespace-nowrap text-base">{t.orders.orderDetails}</CardTitle>
                  <OrderStatusBadges info={badgeInfo} t={t} />
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
                  beforeServiceDay={isBeforeServiceDay(order)}
                />
              </div>
              {orderKind === "BATH" && activeWorkers.length > 0 && (
                <p className="text-xs text-muted-foreground">
                  {t.orders.activeWorkersLabel}:{" "}
                  <span className="font-medium text-foreground">{activeWorkers.join(", ")}</span>
                </p>
              )}
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
                    {order.depositAmount > 0 && (
                      <Badge variant="outline">{t.orders.depositBadge(formatBaht(order.depositAmount))}</Badge>
                    )}
                  </div>
                </div>
              )}
              {/* บิลร้านอาหารเป็น walk-in ไม่ผูกลูกค้า/สัตว์เลี้ยง จึงไม่ต้องมีบล็อกนี้ */}
              {!isShopOrder && (
                <>
                  <div className="grid gap-4 md:grid-cols-2">
                    <DetailSection title={t.orders.owner} icon={UserRound}>
                      <div className="text-sm font-medium">{order.customer?.name ?? "-"}</div>
                      <div className="mt-0.5 text-sm text-muted-foreground">{order.customer?.phone}</div>
                      {order.customer && (
                        <div className="mt-3">
                          <CustomerPreviewButton customerId={order.customer.id} highlightPetId={order.pet?.id ?? null} />
                        </div>
                      )}
                    </DetailSection>

                    <DetailSection title={t.orders.pet} icon={PawPrint}>
                      {order.pet ? (
                        <>
                          <div className="flex flex-wrap items-center gap-1.5 text-sm font-medium">
                            <SpeciesIcon species={order.pet.species} className="h-4 w-4" /> {order.pet.name}
                            {allergyText(order.pet.allergies) && (
                              <span className="text-xs font-normal text-rose-600">({allergyText(order.pet.allergies)})</span>
                            )}
                          </div>
                          {/* ข้อมูลที่ลูกค้ากรอกจากหน้าจอง LINE — น้ำหนัก / ข้อควรระวังระหว่างกรูมมิ่ง / โรคประจำตัว */}
                          <dl className="mt-2 space-y-1 text-xs">
                            {order.pet.weightKg ? (
                              <div>
                                <dt className="inline text-muted-foreground">{t.liffBook.weight}: </dt>
                                <dd className="inline">{order.pet.weightKg}</dd>
                              </div>
                            ) : null}
                            {allergyText(order.pet.groomingCautions) && (
                              <div>
                                <dt className="inline text-muted-foreground">{t.liffBook.cautions}: </dt>
                                <dd className="inline">{allergyText(order.pet.groomingCautions)}</dd>
                              </div>
                            )}
                            {order.pet.hasChronicDisease && (
                              <div>
                                <dt className="inline text-muted-foreground">{t.liffBook.disease}: </dt>
                                <dd className="inline">{order.pet.chronicDiseaseNote || t.liffBook.diseaseYes}</dd>
                              </div>
                            )}
                          </dl>
                        </>
                      ) : (
                        <div className="text-sm">-</div>
                      )}
                    </DetailSection>
                  </div>

                  {showFleaSection && order.pet && (
                    <DetailSection
                      title={t.fleaTick.title}
                      icon={Bug}
                      titleExtra={fleaPassed && <VerifySeal passed label={t.fleaTick.status.COVERED} />}
                    >
                      <div className={cn("grid gap-3", fleaStatusShown && fleaCheck && "md:grid-cols-2")}>
                        <FleaTickStatusBlock
                          className="mt-0"
                          t={t}
                          pet={order.pet}
                          serviceDate={toThaiDateStr(order.appointmentAt ?? order.checkInAt ?? new Date())}
                          alwaysShow={fleaAlwaysShow}
                        />
                        {fleaCheck && (
                          <FleaCheckPanel
                            className="mt-0"
                            orderId={order.id}
                            level={fleaCheck.level}
                            text={fleaCheck.text}
                            evidence={fleaCheck.level === "GREEN" ? [] : (order.pet.fleaTickEvidenceUrls ?? [])}
                            checked={fleaStaffChecked}
                            canAct={!isGroomer && order.status !== "CANCELLED" && fleaCheck.level !== "GREEN"}
                          />
                        )}
                      </div>
                    </DetailSection>
                  )}
                </>
              )}

              {/* ทรงที่ลูกค้าต้องการ (จองอาบน้ำผ่าน LINE) — ข้อความ + ภาพตัวอย่างที่แนบมา */}
              {(order.groomingStyleNote || order.groomingStyleImages.length > 0) && (
                <DetailSection title={t.liffBook.styleTitle} icon={Scissors} className="space-y-2">
                  {order.groomingStyleNote && <p className="whitespace-pre-wrap text-sm">{order.groomingStyleNote}</p>}
                  {order.groomingStyleImages.length > 0 && (
                    <StyleImagesViewer images={order.groomingStyleImages} title={t.liffBook.styleImages} />
                  )}
                </DetailSection>
              )}

              <DetailSection title={t.orders.columnItem} icon={ReceiptText}>
              <div className="overflow-hidden rounded-lg border bg-card">
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
              </DetailSection>

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
                isOnlineBooking={order.createdVia === "LIFF"}
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
