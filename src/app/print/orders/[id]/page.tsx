import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth-helpers";
import { prisma } from "@/lib/prisma";
import { allergyText } from "@/lib/pet-notes";
import { getShopInfo } from "@/lib/settings";
import { formatBaht, formatDateTime } from "@/lib/format";
import { PrintButton } from "@/components/print-button";
import { ReceiptEmailButton } from "@/components/receipt-email-button";
import { getDictionary } from "@/i18n/get-dictionary";
import { getLocale } from "@/i18n/get-locale";

export default async function PrintOrderPage(props: PageProps<"/print/orders/[id]">) {
  await requireUser();
  const { id } = await props.params;

  const order = await prisma.order.findUnique({
    where: { id },
    include: {
      customer: true,
      pet: true,
      room: true,
      items: true,
      extraCharges: true,
      payments: { orderBy: { createdAt: "asc" } },
    },
  });
  if (!order) notFound();

  // สลิปร้านอาหารบอกหน่วยของสินค้า (แก้ว/จาน/ชิ้น) แต่ OrderItem เก็บแค่ชื่อ/ราคา/จำนวน
  // จึงต้องดึงหน่วยจากตารางสินค้าผ่าน refId ที่บันทึกไว้ตอนเปิดบิล
  const productIds = order.items
    .filter((i) => i.itemType === "PRODUCT" && i.refId)
    .map((i) => i.refId!);
  const unitByProductId = new Map(
    productIds.length
      ? (
          await prisma.product.findMany({
            where: { id: { in: productIds } },
            select: { id: true, unit: true },
          })
        ).map((p) => [p.id, p.unit])
      : []
  );

  const extraChargesTotal = order.extraCharges.reduce((sum, c) => sum + c.amount, 0);
  const grandTotal = order.total + extraChargesTotal;
  const shop = await getShopInfo();
  const t = getDictionary(await getLocale());

  const emailButton = (
    <ReceiptEmailButton orderId={order.id} defaultEmail={order.customer?.email ?? ""} />
  );

  /* ---------- บิลร้านอาหาร: สลิปแคบยาวแบบใบเสร็จหน้าร้านทั่วไป (กระดาษความร้อน 80 มม.) ---------- */
  if (order.orderType === "SHOP") {
    const paid = order.payments.find((p) => p.status === "VERIFIED") ?? order.payments[0];
    const methodLabel = paid ? t.labels.paymentMethod[paid.method] : "-";

    return (
      <div className="min-h-dvh bg-zinc-100 p-6 print:bg-white print:p-0">
        {/* กระดาษความร้อนกว้าง 80 มม. — ตั้งขนาดหน้าตอนพิมพ์ให้พอดีม้วน ไม่ต้องตัดเอง */}
        <style>{`@media print { @page { size: 80mm auto; margin: 4mm; } }`}</style>

        {/* ไม่มีปุ่มส่งอีเมล — บิลหน้าร้านเป็น walk-in ไม่มีอีเมลลูกค้าให้ส่ง */}
        <div className="mx-auto mb-4 flex w-[302px] justify-end gap-2 print:hidden">
          <PrintButton />
        </div>

        <div className="mx-auto w-[302px] bg-white p-4 font-mono text-[12px] leading-snug text-zinc-900 shadow-sm print:w-full print:p-0 print:shadow-none">
          <div>
            <div className="font-sans text-base font-bold">{shop.name}</div>
            {shop.address && (
              <div className="mt-1 whitespace-pre-line text-[11px] text-zinc-600">
                {shop.address}
              </div>
            )}
            {shop.taxId && (
              <div className="text-[11px] text-zinc-600">{t.print.taxIdLabel(shop.taxId)}</div>
            )}
            {shop.phone && <div className="text-[11px] text-zinc-600">{shop.phone}</div>}
          </div>

          <div className="my-2 border-t border-dashed border-zinc-400" />

          <div className="flex justify-between">
            <span className="text-zinc-500">{t.print.receiptTitle}</span>
            <span>{order.code}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-zinc-500">{t.print.dateLabel}</span>
            <span>{formatDateTime(order.createdAt)}</span>
          </div>

          <div className="my-2 border-t border-dashed border-zinc-400" />

          {order.items.map((it) => (
            <div key={it.id} className="mb-1.5">
              <div className="font-sans">{it.name}</div>
              <div className="flex justify-between text-zinc-600">
                <span>
                  {t.print.quantityLabel} {it.quantity}{" "}
                  {(it.refId && unitByProductId.get(it.refId)) || ""}
                </span>
                <span className="tabular-nums">{formatBaht(it.subtotal)}</span>
              </div>
            </div>
          ))}

          <div className="my-2 border-t border-dashed border-zinc-400" />

          <div className="flex justify-between font-sans text-base font-bold">
            <span>{t.print.grandTotal}</span>
            <span className="tabular-nums">{formatBaht(grandTotal)}</span>
          </div>
          <div className="mt-1 flex justify-between text-zinc-600">
            <span>{t.print.paidByLabel}</span>
            <span>{methodLabel}</span>
          </div>

          <div className="my-2 border-t border-dashed border-zinc-400" />

          <div className="text-center text-zinc-600">
            <div className="font-sans">{t.print.thankYou}</div>
            {shop.lineId && <div className="mt-0.5">{t.print.lineIdLabel(shop.lineId)}</div>}
          </div>
        </div>
      </div>
    );
  }

  /* ---------- งานบริการ: ใบเสร็จเต็มหน้า + สติกเกอร์ติดกรง ---------- */
  return (
    <div className="min-h-dvh bg-zinc-100 p-6 print:bg-white print:p-0">
      <div className="mx-auto mb-4 flex max-w-[800px] justify-end gap-2 print:hidden">
        {emailButton}
        <PrintButton />
      </div>

      {/* ---------- ใบเสร็จ ---------- */}
      <div className="mx-auto max-w-[800px] rounded-lg bg-white p-8 shadow-sm print:max-w-none print:rounded-none print:shadow-none">
        <div className="flex items-start justify-between border-b pb-4">
          <div>
            <div className="text-2xl font-bold">{shop.name}</div>
            {shop.address && (
              // จำกัดความกว้างให้ที่อยู่ตัดบรรทัดเองประมาณ 3 บรรทัด (และยังเคารพการขึ้นบรรทัดที่พิมพ์มาเอง)
              <div className="mt-1 max-w-[20rem] text-sm whitespace-pre-line text-zinc-500">
                {shop.address}
              </div>
            )}
            {shop.taxId && <div className="text-sm text-zinc-500">{t.print.taxIdLabel(shop.taxId)}</div>}
          </div>
          <div className="text-right">
            <div className="text-lg font-bold">{t.print.receiptTitle}</div>
            <div className="text-sm text-zinc-500">{order.code}</div>
            <div className="text-sm text-zinc-500">{formatDateTime(order.createdAt)}</div>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4 py-4 text-sm">
          <div>
            <div className="text-zinc-400">{t.print.customerLabel}</div>
            <div className="font-medium">{order.customer?.name ?? t.common.walkInCustomer}</div>
            <div className="text-zinc-500">{order.customer?.phone}</div>
          </div>
          <div>
            <div className="text-zinc-400">{t.print.petLabel}</div>
            <div className="font-medium">
              {order.pet ? `${order.pet.name} (${t.labels.species[order.pet.species]})` : "-"}
            </div>
          </div>
        </div>

        {/* ใบเสร็จที่รายการยาวเกิน 1 หน้า: บังคับให้ thead ซ้ำหัวทุกหน้าที่พิมพ์
            (เบราว์เซอร์บางตัวไม่ทำให้เองถ้าตารางถูกจัดเลย์เอาต์ด้วย CSS อื่น)
            และเพิ่มแถวระบุร้าน/เลขที่บิล เพื่อให้หน้าที่ 2 เป็นต้นไปรู้ว่าเป็นใบเสร็จของบิลไหน */}
        <table className="w-full text-sm">
          <thead className="table-header-group">
            <tr className="hidden print:table-row">
              <th colSpan={4} className="px-2 pt-3 pb-1 text-left">
                <span className="font-bold">{shop.name}</span>
                <span className="ml-2 font-normal text-zinc-500">
                  {t.print.receiptTitle} {order.code}
                </span>
              </th>
            </tr>
            <tr className="border-y bg-zinc-50 text-zinc-500">
              <th className="px-2 py-2 text-left font-medium">{t.print.columnItem}</th>
              <th className="px-2 py-2 text-center font-medium">{t.print.columnQty}</th>
              <th className="px-2 py-2 text-right font-medium">{t.print.columnUnitPrice}</th>
              <th className="px-2 py-2 text-right font-medium">{t.print.columnSubtotal}</th>
            </tr>
          </thead>
          <tbody>
            {order.items.map((it) => (
              <tr key={it.id} className="border-b break-inside-avoid">
                <td className="px-2 py-2">{it.name}</td>
                <td className="px-2 py-2 text-center">{it.quantity}</td>
                <td className="px-2 py-2 text-right">{formatBaht(it.unitPrice)}</td>
                <td className="px-2 py-2 text-right">{formatBaht(it.subtotal)}</td>
              </tr>
            ))}
            {order.extraCharges.map((c) => (
              <tr key={c.id} className="border-b text-red-600 break-inside-avoid">
                <td className="px-2 py-2">{c.description}</td>
                <td className="px-2 py-2 text-center">1</td>
                <td className="px-2 py-2 text-right">{formatBaht(c.amount)}</td>
                <td className="px-2 py-2 text-right">{formatBaht(c.amount)}</td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            {order.holidaySurcharge > 0 && (
              <tr>
                <td colSpan={3} className="px-2 py-2 text-right font-semibold text-red-600">
                  {t.print.holidaySurchargeLabel(order.holidayLabel ?? "")}
                </td>
                <td className="px-2 py-2 text-right font-bold text-red-600">
                  +{formatBaht(order.holidaySurcharge)}
                </td>
              </tr>
            )}
            <tr>
              <td colSpan={3} className="px-2 py-3 text-right font-semibold">
                {t.print.grandTotal}
              </td>
              <td className="px-2 py-3 text-right text-lg font-bold">{formatBaht(grandTotal)}</td>
            </tr>
          </tfoot>
        </table>

        <div className="mt-6 border-t pt-4 text-center text-sm text-zinc-400">
          {t.print.thankYou}
          {shop.lineId && <div className="mt-1">{t.print.lineIdLabel(shop.lineId)}</div>}
        </div>
      </div>

      {/* ---------- สติกเกอร์ติดกรง ---------- */}
      <div className="mx-auto mt-6 max-w-[800px] break-before-page print:mt-0">
        <div className="mx-auto w-[400px] rounded-xl border-2 border-dashed border-zinc-400 bg-white p-5 print:border-solid">
          <div className="mb-2 flex items-center justify-between border-b border-zinc-200 pb-2">
            <div className="text-lg font-bold">
              {order.pet ? order.pet.name : order.customer?.name}
            </div>
            <div className="text-sm font-medium text-zinc-500">{order.code}</div>
          </div>
          <div className="space-y-1 text-sm">
            <div>
              <span className="text-zinc-400">{t.print.ownerLabel}</span> {order.customer?.name} ·{" "}
              {order.customer?.phone}
            </div>
            {order.pet && (
              <div>
                <span className="text-zinc-400">{t.print.speciesLabel}</span> {t.labels.species[order.pet.species]}
                {order.pet.breed ? ` · ${order.pet.breed}` : ""}
              </div>
            )}
            {order.room && (
              <div>
                <span className="text-zinc-400">{t.print.roomLabel}</span> {order.room.name}
                {order.nights ? t.print.nightsSuffix(order.nights) : ""}
              </div>
            )}
            <div>
              <span className="text-zinc-400">{t.print.serviceLabel}</span>{" "}
              {order.items
                .filter((i) => i.itemType !== "PRODUCT")
                .map((i) => i.name)
                .join(", ") || "-"}
            </div>
            {allergyText(order.pet?.allergies) && (
              <div className="mt-2 rounded-md bg-rose-100 px-2 py-1 font-medium text-rose-700">
                {t.print.allergyWarning(allergyText(order.pet?.allergies)!)}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
