import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth-helpers";
import { prisma } from "@/lib/prisma";
import { getShopInfo } from "@/lib/settings";
import { formatBaht, formatDateTime } from "@/lib/format";
import { PrintButton } from "@/components/print-button";
import { getDictionary } from "@/i18n/get-dictionary";
import { getLocale } from "@/i18n/get-locale";

export default async function PrintOrderPage(props: PageProps<"/print/orders/[id]">) {
  await requireUser();
  const { id } = await props.params;

  const order = await prisma.order.findUnique({
    where: { id },
    include: { customer: true, pet: true, room: true, items: true, extraCharges: true },
  });
  if (!order) notFound();

  const extraChargesTotal = order.extraCharges.reduce((sum, c) => sum + c.amount, 0);
  const shop = await getShopInfo();
  const t = getDictionary(await getLocale());

  return (
    <div className="min-h-dvh bg-zinc-100 p-6 print:bg-white print:p-0">
      <div className="mx-auto mb-4 flex max-w-[800px] justify-end print:hidden">
        <PrintButton />
      </div>

      {/* ---------- ใบเสร็จ ---------- */}
      <div className="mx-auto max-w-[800px] rounded-lg bg-white p-8 shadow-sm print:max-w-none print:rounded-none print:shadow-none">
        <div className="flex items-start justify-between border-b pb-4">
          <div>
            <div className="text-2xl font-bold">{shop.name}</div>
            {shop.address && (
              <div className="mt-1 text-sm whitespace-pre-line text-zinc-500">{shop.address}</div>
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
            <div className="font-medium">{order.customer.name}</div>
            <div className="text-zinc-500">{order.customer.phone}</div>
          </div>
          <div>
            <div className="text-zinc-400">{t.print.petLabel}</div>
            <div className="font-medium">
              {order.pet ? `${order.pet.name} (${t.labels.species[order.pet.species]})` : "-"}
            </div>
            <div className="text-zinc-500">{t.print.statusLabel(t.labels.orderStatus[order.status])}</div>
          </div>
        </div>

        <table className="w-full text-sm">
          <thead>
            <tr className="border-y bg-zinc-50 text-zinc-500">
              <th className="px-2 py-2 text-left font-medium">{t.print.columnItem}</th>
              <th className="px-2 py-2 text-center font-medium">{t.print.columnQty}</th>
              <th className="px-2 py-2 text-right font-medium">{t.print.columnUnitPrice}</th>
              <th className="px-2 py-2 text-right font-medium">{t.print.columnSubtotal}</th>
            </tr>
          </thead>
          <tbody>
            {order.items.map((it) => (
              <tr key={it.id} className="border-b">
                <td className="px-2 py-2">{it.name}</td>
                <td className="px-2 py-2 text-center">{it.quantity}</td>
                <td className="px-2 py-2 text-right">{formatBaht(it.unitPrice)}</td>
                <td className="px-2 py-2 text-right">{formatBaht(it.subtotal)}</td>
              </tr>
            ))}
            {order.extraCharges.map((c) => (
              <tr key={c.id} className="border-b text-red-600">
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
              <td className="px-2 py-3 text-right text-lg font-bold">
                {formatBaht(order.total + extraChargesTotal)}
              </td>
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
              {order.pet ? order.pet.name : order.customer.name}
            </div>
            <div className="text-sm font-medium text-zinc-500">{order.code}</div>
          </div>
          <div className="space-y-1 text-sm">
            <div>
              <span className="text-zinc-400">{t.print.ownerLabel}</span> {order.customer.name} ·{" "}
              {order.customer.phone}
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
            {order.pet?.allergies && (
              <div className="mt-2 rounded-md bg-rose-100 px-2 py-1 font-medium text-rose-700">
                {t.print.allergyWarning(order.pet.allergies)}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
