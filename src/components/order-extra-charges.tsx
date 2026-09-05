"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Loader2, Save, Plus, Pencil, Trash2 } from "lucide-react";
import { addExtraCharge, updateExtraCharge, deleteExtraCharge } from "@/app/actions/orders";
import { formatBaht, formatDateTime } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useI18n } from "@/components/i18n-provider";

type ExtraCharge = {
  id: string;
  amount: number;
  description: string;
  createdAt: string;
  createdByName: string | null;
};

/** ค่าเสียหายเพิ่มเติม (เช่น อาบน้ำแล้วโดนกัดต้องทำแผล) — เห็นเฉพาะฝั่งหลังบ้าน ไม่รวมเข้ายอดออเดอร์อัตโนมัติ */
export function OrderExtraCharges({
  orderId,
  charges,
  canEdit,
}: {
  orderId: string;
  charges: ExtraCharge[];
  /** ชำระเงินครบถ้วนแล้วแก้ไข/เพิ่ม/ลบไม่ได้อีก เพราะยอดที่จ่ายไปแล้วจะไม่ถูกเรียกเก็บเพิ่มอัตโนมัติ */
  canEdit: boolean;
}) {
  const { t } = useI18n();
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [adding, setAdding] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [amount, setAmount] = useState("");
  const [description, setDescription] = useState("");

  function openAdd() {
    setEditingId(null);
    setAmount("");
    setDescription("");
    setAdding(true);
  }

  function openEdit(c: ExtraCharge) {
    setEditingId(c.id);
    setAmount(String(c.amount));
    setDescription(c.description);
    setAdding(true);
  }

  function closeForm() {
    setAdding(false);
    setEditingId(null);
    setAmount("");
    setDescription("");
  }

  function save() {
    startTransition(async () => {
      const res = editingId
        ? await updateExtraCharge(editingId, { amount: Number(amount || 0), description })
        : await addExtraCharge(orderId, { amount: Number(amount || 0), description });
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      toast.success(res.message);
      closeForm();
      router.refresh();
    });
  }

  function remove(id: string) {
    if (!confirm(t.orders.extraCharges.confirmDelete)) return;
    startTransition(async () => {
      const res = await deleteExtraCharge(id);
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      toast.success(res.message);
      router.refresh();
    });
  }

  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between">
        <CardTitle className="text-base">
          {t.orders.extraCharges.title}
        </CardTitle>
        {canEdit && !adding && (
          <Button size="sm" variant="outline" onClick={openAdd}>
            <Plus /> {t.orders.extraCharges.add}
          </Button>
        )}
      </CardHeader>
      <CardContent className="space-y-3">
        {charges.length === 0 && !adding && (
          <p className="py-2 text-center text-sm text-muted-foreground">{t.orders.extraCharges.empty}</p>
        )}

        {charges.map((c) => (
          <div key={c.id} className="flex items-start justify-between gap-2 rounded-lg border p-3 text-sm">
            <div className="min-w-0">
              <div className="font-medium text-amber-700 dark:text-amber-400">{formatBaht(c.amount)}</div>
              <div className="text-muted-foreground">{c.description}</div>
              <div className="text-xs text-muted-foreground/70">
                {c.createdByName ?? "-"} · {formatDateTime(c.createdAt)}
              </div>
            </div>
            {canEdit && (
              <div className="flex shrink-0 gap-1">
                <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => openEdit(c)}>
                  <Pencil className="h-3.5 w-3.5" />
                </Button>
                <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => remove(c.id)}>
                  <Trash2 className="h-3.5 w-3.5 text-destructive" />
                </Button>
              </div>
            )}
          </div>
        ))}

        {adding && (
          <div className="space-y-2 rounded-lg border p-3">
            <div className="grid gap-2 sm:grid-cols-[1fr_140px]">
              <div className="space-y-1">
                <Label className="text-xs">{t.orders.extraCharges.descriptionLabel}</Label>
                <Input value={description} onChange={(e) => setDescription(e.target.value)} />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">{t.orders.extraCharges.amountLabel}</Label>
                <Input type="number" min={0} value={amount} onChange={(e) => setAmount(e.target.value)} />
              </div>
            </div>
            <div className="flex justify-end gap-2">
              <Button size="sm" variant="ghost" onClick={closeForm}>
                {t.common.cancel}
              </Button>
              <Button size="sm" onClick={save} disabled={isPending || !amount || !description}>
                {isPending ? <Loader2 className="animate-spin" /> : <Save />}
                {t.common.save}
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
