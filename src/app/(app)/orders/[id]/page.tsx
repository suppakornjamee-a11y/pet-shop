import Link from "next/link";
import { notFound } from "next/navigation";
import { Printer, ArrowLeft, PawPrint, Pencil } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { payloadToDataUrl } from "@/lib/promptpay";
import { formatBaht, formatDateTime } from "@/lib/format";
import {
  orderStatusLabel,
  orderStatusColor,
  speciesEmoji,
} from "@/lib/labels";
import { cn } from "@/lib/utils";
import { PageHeader } from "@/components/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { PaymentPanel } from "@/components/payment-panel";
import { OrderStatusControl } from "@/components/order-status-control";

export default async function OrderDetailPage(props: PageProps<"/orders/[id]">) {
  const { id } = await props.params;

  const order = await prisma.order.findUnique({
    where: { id },
    include: {
      customer: true,
      pet: true,
      room: true,
      items: true,
      payment: { include: { bankAccount: true } },
    },
  });

  if (!order) notFound();

  const qrDataUrl = order.payment?.qrPayload
    ? await payloadToDataUrl(order.payment.qrPayload)
    : null;

  return (
    <div className="mx-auto max-w-5xl">
      <PageHeader
        title={order.code}
        description={`สร้างเมื่อ ${formatDateTime(order.createdAt)}`}
        action={
          <>
            <Button render={<Link href="/orders" />} nativeButton={false} variant="outline">
              <ArrowLeft /> กลับ
            </Button>
            {order.status === "PENDING_PAYMENT" && (
              <Button
                render={<Link href={`/orders/${order.id}/edit`} />}
                nativeButton={false}
                variant="outline"
              >
                <Pencil /> แก้ไขออเดอร์
              </Button>
            )}
            {["PAID", "IN_PROGRESS", "COMPLETED"].includes(order.status) && (
              <Button
                render={<Link href={`/print/orders/${order.id}`} target="_blank" />}
                nativeButton={false}
                variant="secondary"
              >
                <Printer /> พิมพ์เอกสาร
              </Button>
            )}
          </>
        }
      />

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <Card>
            <CardHeader className="flex-row items-center justify-between">
              <CardTitle className="text-base">รายละเอียดออเดอร์</CardTitle>
              <Badge
                variant="outline"
                className={cn("text-xs", orderStatusColor[order.status])}
              >
                {orderStatusLabel[order.status]}
              </Badge>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <div className="text-xs text-muted-foreground">เจ้าของ</div>
                  <div className="font-medium">{order.customer.name}</div>
                  <div className="text-sm text-muted-foreground">{order.customer.phone}</div>
                </div>
                <div>
                  <div className="text-xs text-muted-foreground">สัตว์เลี้ยง</div>
                  <div className="font-medium">
                    {order.pet ? (
                      <>
                        {speciesEmoji[order.pet.species]} {order.pet.name}
                      </>
                    ) : (
                      "-"
                    )}
                  </div>
                  {order.pet?.allergies && (
                    <div className="text-sm text-rose-600">⚠️ แพ้: {order.pet.allergies}</div>
                  )}
                </div>
              </div>

              <div className="overflow-hidden rounded-lg border">
                <table className="w-full text-sm">
                  <thead className="bg-muted/50 text-muted-foreground">
                    <tr>
                      <th className="px-3 py-2 text-left font-medium">รายการ</th>
                      <th className="px-3 py-2 text-center font-medium">จำนวน</th>
                      <th className="px-3 py-2 text-right font-medium">ราคา</th>
                      <th className="px-3 py-2 text-right font-medium">รวม</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {order.items.map((it) => (
                      <tr key={it.id}>
                        <td className="px-3 py-2">{it.name}</td>
                        <td className="px-3 py-2 text-center">{it.quantity}</td>
                        <td className="px-3 py-2 text-right">{formatBaht(it.unitPrice)}</td>
                        <td className="px-3 py-2 text-right font-medium">
                          {formatBaht(it.subtotal)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot className="border-t bg-muted/30">
                    <tr>
                      <td colSpan={3} className="px-3 py-2 text-right font-semibold">
                        ยอดรวมทั้งสิ้น
                      </td>
                      <td className="px-3 py-2 text-right text-base font-bold text-primary">
                        {formatBaht(order.total)}
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>

              {order.note && (
                <div className="rounded-lg bg-muted/40 p-3 text-sm">
                  <span className="text-muted-foreground">หมายเหตุ: </span>
                  {order.note}
                </div>
              )}
            </CardContent>
          </Card>

          <OrderStatusControl orderId={order.id} status={order.status} />
        </div>

        <div className="lg:col-span-1">
          {order.payment ? (
            <PaymentPanel
              orderId={order.id}
              orderStatus={order.status}
              qrDataUrl={qrDataUrl}
              amount={order.payment.amount}
              status={order.payment.status}
              expiresAt={order.payment.expiresAt?.toISOString() ?? null}
              rejectReason={order.payment.rejectReason}
              account={
                order.payment.bankAccount
                  ? {
                      bankName: order.payment.bankAccount.bankName,
                      accountName: order.payment.bankAccount.accountName,
                      accountNumber: order.payment.bankAccount.accountNumber,
                    }
                  : null
              }
            />
          ) : (
            <Card>
              <CardContent className="py-10 text-center text-sm text-muted-foreground">
                <PawPrint className="mx-auto mb-2 h-8 w-8 opacity-40" />
                ไม่มีข้อมูลการชำระเงิน
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
