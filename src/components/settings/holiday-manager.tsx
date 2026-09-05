"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Loader2, Save, Plus, Pencil, Trash2 } from "lucide-react";
import { upsertHoliday, deleteHoliday } from "@/app/actions/settings";
import { formatBaht, formatDateLong } from "@/lib/format";
import { useI18n } from "@/components/i18n-provider";
import { useConfirm } from "@/components/confirm-provider";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

type Holiday = {
  id: string;
  date: string;
  title: string;
  extraCharge: number;
};

const empty = { date: "", title: "", extraCharge: "0" };

export function HolidayManager({ holidays }: { holidays: Holiday[] }) {
  const { t } = useI18n();
  const confirm = useConfirm();
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Holiday | null>(null);
  const [form, setForm] = useState(empty);

  function openNew() {
    setEditing(null);
    setForm(empty);
    setOpen(true);
  }
  function openEdit(h: Holiday) {
    setEditing(h);
    setForm({ date: h.date, title: h.title, extraCharge: String(h.extraCharge) });
    setOpen(true);
  }

  function save() {
    startTransition(async () => {
      const res = await upsertHoliday({
        id: editing?.id,
        date: form.date,
        title: form.title,
        extraCharge: form.extraCharge,
      });
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      toast.success(res.message);
      setOpen(false);
      router.refresh();
    });
  }

  async function remove(id: string) {
    if (!(await confirm({ title: t.settings.holidays.confirmDelete, tone: "danger" }))) return;
    startTransition(async () => {
      const res = await deleteHoliday(id);
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      toast.success(res.message);
      router.refresh();
    });
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Button onClick={openNew}>
          <Plus /> {t.settings.holidays.addHoliday}
        </Button>
      </div>

      <Card>
        <CardContent className="p-0">
          <div className="divide-y">
            {holidays.map((h) => (
              <div key={h.id} className="flex items-center justify-between gap-3 p-4">
                <div className="flex items-center gap-3">
                  <div>
                    <div className="font-medium">{h.title}</div>
                    <div className="text-xs text-muted-foreground">
                      {formatDateLong(`${h.date}T00:00:00+07:00`)} · ({formatBaht(h.extraCharge)})
                    </div>
                  </div>
                </div>
                <div className="flex gap-1">
                  <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => openEdit(h)}>
                    <Pencil className="h-4 w-4" />
                  </Button>
                  <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => remove(h.id)}>
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                </div>
              </div>
            ))}
            {holidays.length === 0 && (
              <p className="p-4 text-sm text-muted-foreground">{t.settings.holidays.empty}</p>
            )}
          </div>
        </CardContent>
      </Card>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {editing ? t.settings.holidays.editHoliday : t.settings.holidays.addHoliday}
            </DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label>{t.settings.holidays.dateLabel} *</Label>
              <Input
                type="date"
                value={form.date}
                onChange={(e) => setForm({ ...form, date: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label>{t.settings.holidays.extraChargeLabel} *</Label>
              <Input
                type="number"
                min={0}
                value={form.extraCharge}
                onChange={(e) => setForm({ ...form, extraCharge: e.target.value })}
              />
            </div>
            <div className="space-y-2 sm:col-span-2">
              <Label>{t.settings.holidays.titleLabel} *</Label>
              <Input
                value={form.title}
                onChange={(e) => setForm({ ...form, title: e.target.value })}
              />
            </div>
          </div>
          <DialogFooter>
            <Button onClick={save} disabled={isPending || !form.date || !form.title}>
              {isPending ? <Loader2 className="animate-spin" /> : <Save />}
              {t.common.save}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
