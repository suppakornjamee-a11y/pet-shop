"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Trash2 } from "lucide-react";
import { removeOrderItem } from "@/app/actions/orders";
import { formatBaht } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { useI18n } from "@/components/i18n-provider";

type Item = { id: string; name: string; quantity: number; unitPrice: number; subtotal: number };

/** แถวรายการในตารางออเดอร์ — ลบรายการได้เมื่อ canEdit (ยอดคงเหลือยังไม่ชำระ) */
export function OrderItemsRows({ items, canEdit }: { items: Item[]; canEdit: boolean }) {
  const { t } = useI18n();
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  function remove(id: string) {
    if (!confirm(t.orders.confirmDeleteItem)) return;
    startTransition(async () => {
      const res = await removeOrderItem(id);
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      router.refresh();
    });
  }

  return (
    <>
      {items.map((it) => (
        <tr key={it.id}>
          <td className="px-3 py-2">{it.name}</td>
          <td className="px-3 py-2 text-center">{it.quantity}</td>
          <td className="px-3 py-2 text-right">{formatBaht(it.unitPrice)}</td>
          <td className="px-3 py-2 text-right font-medium">
            <div className="flex items-center justify-end gap-2">
              {formatBaht(it.subtotal)}
              {canEdit && (
                <Button
                  type="button"
                  size="icon"
                  variant="ghost"
                  className="h-6 w-6"
                  disabled={isPending}
                  onClick={() => remove(it.id)}
                >
                  <Trash2 className="h-3 w-3 text-destructive" />
                </Button>
              )}
            </div>
          </td>
        </tr>
      ))}
    </>
  );
}
