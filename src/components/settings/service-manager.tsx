"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Loader2, Save, Plus, Pencil, Trash2 } from "lucide-react";
import { upsertService, deleteService } from "@/app/actions/settings";
import type { ServiceCategory, ServiceGroup, Species } from "@/generated/prisma/enums";
import { formatBaht } from "@/lib/format";
import { useI18n } from "@/components/i18n-provider";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

type ServiceRow = {
  id: string;
  name: string;
  category: ServiceCategory;
  group: ServiceGroup | null;
  speciesScope: Species | null;
  defaultOn: boolean;
  sortOrder: number;
  price: number;
  active: boolean;
  commissionPercent: number | null;
  commissionFlat: number | null;
};

const empty = {
  name: "",
  category: "BATH" as ServiceCategory,
  group: "none",
  speciesScope: "both",
  defaultOn: false,
  sortOrder: "0",
  price: "0",
  commissionPercent: "",
  commissionFlat: "",
  active: true,
};

export function ServiceManager({ services }: { services: ServiceRow[] }) {
  const { t } = useI18n();
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<ServiceRow | null>(null);
  const [form, setForm] = useState(empty);

  const grouped = useMemo(() => {
    const map = new Map<string, ServiceRow[]>();
    for (const s of services) {
      const key = s.category === "BATH" && s.group ? s.group : s.category;
      const list = map.get(key) ?? [];
      list.push(s);
      map.set(key, list);
    }
    return [...map.entries()];
  }, [services]);

  function labelFor(key: string) {
    return key in t.labels.serviceGroup
      ? t.labels.serviceGroup[key as keyof typeof t.labels.serviceGroup]
      : t.labels.serviceCategory[key as keyof typeof t.labels.serviceCategory];
  }

  function openNew() {
    setEditing(null);
    setForm(empty);
    setOpen(true);
  }
  function openNewForGroup(key: string) {
    setEditing(null);
    const isGroup = key === "ADDON" || key === "TREATMENT" || key === "SPA";
    setForm({
      ...empty,
      category: isGroup ? "BATH" : (key as ServiceCategory),
      group: isGroup ? key : "none",
    });
    setOpen(true);
  }
  function openEdit(s: ServiceRow) {
    setEditing(s);
    setForm({
      name: s.name,
      category: s.category,
      group: s.group ?? "none",
      speciesScope: s.speciesScope ?? "both",
      defaultOn: s.defaultOn,
      sortOrder: String(s.sortOrder),
      price: String(s.price),
      commissionPercent: s.commissionPercent != null ? String(s.commissionPercent) : "",
      commissionFlat: s.commissionFlat != null ? String(s.commissionFlat) : "",
      active: s.active,
    });
    setOpen(true);
  }

  function save() {
    startTransition(async () => {
      const res = await upsertService({
        id: editing?.id,
        name: form.name,
        category: form.category,
        group: form.group === "none" ? undefined : form.group,
        speciesScope: form.speciesScope === "both" ? undefined : form.speciesScope,
        defaultOn: form.defaultOn,
        sortOrder: Number(form.sortOrder || 0),
        price: Number(form.price || 0),
        active: form.active,
        commissionPercent: form.commissionPercent === "" ? undefined : Number(form.commissionPercent),
        commissionFlat: form.commissionFlat === "" ? undefined : Number(form.commissionFlat),
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

  function remove(id: string) {
    if (!confirm(t.settings.services.confirmDelete)) return;
    startTransition(async () => {
      const res = await deleteService(id);
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      toast.success(res.message);
      router.refresh();
    });
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-end">
        <Button onClick={openNew}>
          <Plus /> {t.settings.services.addService}
        </Button>
      </div>

      {grouped.map(([key, list]) => (
        <div key={key}>
          <div className="mb-2 flex items-center gap-1.5">
            <span className="text-sm font-semibold text-muted-foreground">{labelFor(key)}</span>
            <Button
              type="button"
              size="icon"
              variant="ghost"
              className="h-6 w-6"
              onClick={() => openNewForGroup(key)}
            >
              <Plus className="h-3.5 w-3.5" />
            </Button>
          </div>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {list.map((s) => (
              <Card key={s.id} className={!s.active ? "opacity-50" : undefined}>
                <CardContent className="space-y-2 py-2">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <div className="truncate font-medium">{s.name}</div>
                      <div className="flex flex-wrap items-center gap-1 pt-1">
                        {s.speciesScope && (
                          <Badge variant="secondary" className="text-[10px]">
                            {t.labels.species[s.speciesScope]}
                          </Badge>
                        )}
                        {s.defaultOn && (
                          <Badge variant="secondary" className="text-[10px]">
                            {t.settings.services.defaultOnCheckbox.split(" (")[0]}
                          </Badge>
                        )}
                        {!s.active && (
                          <Badge variant="outline" className="text-[10px]">
                            {t.common.inactive}
                          </Badge>
                        )}
                        {(s.commissionPercent || s.commissionFlat) && (
                          <Badge variant="secondary" className="text-[10px]">
                            {t.settings.services.commissionBadge(
                              s.commissionPercent ?? 0,
                              s.commissionFlat ?? 0
                            )}
                          </Badge>
                        )}
                      </div>
                    </div>
                    {s.price > 0 ? (
                      <span className="shrink-0 font-medium">{formatBaht(s.price)}</span>
                    ) : (
                      <Badge variant="outline" className="shrink-0 text-[10px]">
                        {t.settings.services.noPriceBadge}
                      </Badge>
                    )}
                  </div>
                  <div className="flex justify-end gap-1">
                    <Button size="sm" variant="ghost" onClick={() => openEdit(s)}>
                      <Pencil className="h-4 w-4" /> {t.common.edit}
                    </Button>
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-8 w-8"
                      onClick={() => remove(s.id)}
                    >
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      ))}
      {services.length === 0 && (
        <p className="text-sm text-muted-foreground">{t.settings.services.empty}</p>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>
              {editing ? t.settings.services.editService : t.settings.services.addService}
            </DialogTitle>
          </DialogHeader>
          <div className="grid gap-x-4 gap-y-3 sm:grid-cols-2">
            <div className="space-y-2 sm:col-span-2">
              <Label>{t.settings.services.nameLabel}</Label>
              <Input
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label>{t.settings.services.categoryLabel}</Label>
              <Select
                value={form.category}
                onValueChange={(v) =>
                  setForm({ ...form, category: (v as ServiceCategory) ?? "BATH" })
                }
                items={t.labels.serviceCategory}
              >
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {(Object.keys(t.labels.serviceCategory) as ServiceCategory[]).map((c) => (
                    <SelectItem key={c} value={c}>
                      {t.labels.serviceCategory[c]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>{t.settings.services.groupLabel}</Label>
              <Select
                value={form.group}
                onValueChange={(v) => setForm({ ...form, group: v ?? "none" })}
                items={{
                  none: t.settings.services.groupNone,
                  ...t.labels.serviceGroup,
                }}
                disabled={form.category !== "BATH"}
              >
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">{t.settings.services.groupNone}</SelectItem>
                  {(Object.keys(t.labels.serviceGroup) as ServiceGroup[]).map((g) => (
                    <SelectItem key={g} value={g}>
                      {t.labels.serviceGroup[g]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>{t.settings.services.speciesScopeLabel}</Label>
              <Select
                value={form.speciesScope}
                onValueChange={(v) => setForm({ ...form, speciesScope: v ?? "both" })}
                items={{ both: t.settings.services.speciesBoth, ...t.labels.species }}
              >
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="both">{t.settings.services.speciesBoth}</SelectItem>
                  {(Object.keys(t.labels.species) as Species[]).map((sp) => (
                    <SelectItem key={sp} value={sp}>
                      {t.labels.species[sp]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>{t.settings.services.priceLabel}</Label>
              <Input
                type="number"
                min={0}
                value={form.price}
                onChange={(e) => setForm({ ...form, price: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label>{t.settings.services.sortOrderLabel}</Label>
              <Input
                type="number"
                value={form.sortOrder}
                onChange={(e) => setForm({ ...form, sortOrder: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label>{t.settings.services.commissionPercentLabel}</Label>
              <Input
                type="number"
                min={0}
                max={100}
                value={form.commissionPercent}
                onChange={(e) => setForm({ ...form, commissionPercent: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label>{t.settings.services.commissionFlatLabel}</Label>
              <Input
                type="number"
                min={0}
                value={form.commissionFlat}
                onChange={(e) => setForm({ ...form, commissionFlat: e.target.value })}
              />
            </div>
            <label className="flex items-start gap-2 pt-1 text-sm sm:col-span-2">
              <input
                type="checkbox"
                checked={form.defaultOn}
                onChange={(e) => setForm({ ...form, defaultOn: e.target.checked })}
                className="mt-0.5 h-4 w-4 shrink-0 accent-primary"
              />
              <span>{t.settings.services.defaultOnCheckbox}</span>
            </label>
            <label className="flex items-center justify-between gap-2 rounded-lg border p-3 text-sm sm:col-span-2">
              <span className="font-medium">{t.settings.services.activeToggleLabel}</span>
              <Switch
                checked={form.active}
                onCheckedChange={(checked) => setForm({ ...form, active: checked })}
              />
            </label>
          </div>
          <DialogFooter>
            <Button onClick={save} disabled={isPending || !form.name}>
              {isPending ? <Loader2 className="animate-spin" /> : <Save />}
              {t.common.save}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
