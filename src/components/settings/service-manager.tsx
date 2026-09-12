"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Loader2, Save, Plus, Pencil, Trash2, Search } from "lucide-react";
import { upsertService, deleteService } from "@/app/actions/settings";
import type { ServiceCategory, ServiceGroup, Species } from "@/generated/prisma/enums";
import { formatBaht } from "@/lib/format";
import { useI18n } from "@/components/i18n-provider";
import { useConfirm } from "@/components/confirm-provider";
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

const GROUP_ORDER = ["BATH", "GROOMING", "ADDON", "TREATMENT", "SPA", "OTHER", "BOARDING"];

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
  const confirm = useConfirm();
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<ServiceRow | null>(null);
  const [form, setForm] = useState(empty);

  const [query, setQuery] = useState("");
  const [showInactive, setShowInactive] = useState(true);

  const inactiveCount = useMemo(() => services.filter((s) => !s.active).length, [services]);

  const grouped = useMemo(() => {
    const q = query.trim().toLowerCase();
    const map = new Map<string, ServiceRow[]>();
    for (const s of services) {
      if (!showInactive && !s.active) continue;
      if (q && !s.name.toLowerCase().includes(q)) continue;
      const key = s.category === "BATH" && s.group ? s.group : s.category;
      (map.get(key) ?? map.set(key, []).get(key)!).push(s);
    }
    // เรียงหมวดตามลำดับเดียวกับที่พนักงานเห็นตอนสร้างออเดอร์ และเรียงรายการในหมวดตามราคา
    // เพื่อให้หน้าตั้งค่ากับหน้าใช้งานจริงไล่สายตาตรงกัน
    for (const list of map.values()) {
      list.sort((a, b) => a.price - b.price || a.name.localeCompare(b.name, "th"));
    }
    return GROUP_ORDER.filter((k) => map.get(k)?.length).map(
      (k) => [k, map.get(k)!] as const
    );
  }, [services, query, showInactive]);

  const shownCount = useMemo(
    () => grouped.reduce((sum, [, list]) => sum + list.length, 0),
    [grouped]
  );

  function labelFor(key: string) {
    return key in t.labels.serviceGroup
      ? t.labels.serviceGroup[key as keyof typeof t.labels.serviceGroup]
      : t.labels.serviceCategory[key as keyof typeof t.labels.serviceCategory];
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

  async function remove(id: string) {
    if (!(await confirm({ title: t.settings.services.confirmDelete, tone: "danger" }))) return;
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
      {/* แถบค้นหา/ตัวกรอง ค้างไว้บนสุดตอนเลื่อน — บริการมีหลายสิบรายการ ถ้าต้องเลื่อนกลับขึ้นมา
          ทุกครั้งที่จะค้นหรือกดเพิ่มจะเสียเวลา */}
      <div className="sticky top-16 z-10 -mx-1 flex flex-wrap items-center gap-2 bg-background/95 px-1 py-2 backdrop-blur">
        <div className="relative min-w-0 flex-1">
          <Search className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={t.settings.services.searchPlaceholder}
            className="pl-9"
          />
        </div>
        {inactiveCount > 0 && (
          <label className="flex shrink-0 cursor-pointer items-center gap-2 text-xs text-muted-foreground">
            <Switch checked={showInactive} onCheckedChange={setShowInactive} />
            {t.settings.services.showInactive}
          </label>
        )}
      </div>

      {grouped.map(([key, list]) => (
        <div key={key}>
          <div className="mb-2 flex items-center gap-2 border-b pb-1.5">
            <span className="text-sm font-semibold">{labelFor(key)}</span>
            <Badge variant="secondary" className="text-[10px] font-normal">
              {t.settings.services.countBadge(list.length)}
            </Badge>
            <Button
              type="button"
              size="sm"
              variant="ghost"
              className="ml-auto h-7 text-xs text-muted-foreground"
              onClick={() => openNewForGroup(key)}
            >
              <Plus className="h-3.5 w-3.5" /> {t.settings.services.addToGroup}
            </Button>
          </div>
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {list.map((s) => (
              <Card key={s.id} className={!s.active ? "opacity-50" : undefined}>
                <CardContent className="py-2.5">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-baseline justify-between gap-2">
                        <span className="truncate font-medium">{s.name}</span>
                        {s.price > 0 ? (
                          <span className="shrink-0 text-sm font-semibold text-primary">
                            {formatBaht(s.price)}
                          </span>
                        ) : (
                          <Badge variant="outline" className="shrink-0 text-[10px]">
                            {t.settings.services.noPriceBadge}
                          </Badge>
                        )}
                      </div>
                      <div className="flex flex-wrap items-center gap-1 pt-1.5">
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
                    <div className="flex shrink-0 gap-0.5">
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-7 w-7"
                        aria-label={t.common.edit}
                        onClick={() => openEdit(s)}
                      >
                        <Pencil className="h-3.5 w-3.5" />
                      </Button>
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-7 w-7"
                        aria-label={t.common.delete}
                        onClick={() => remove(s.id)}
                      >
                        <Trash2 className="h-3.5 w-3.5 text-destructive" />
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      ))}
      {services.length === 0 ? (
        <p className="py-10 text-center text-sm text-muted-foreground">{t.settings.services.empty}</p>
      ) : shownCount === 0 ? (
        <p className="py-10 text-center text-sm text-muted-foreground">
          {t.settings.services.noMatches}
        </p>
      ) : null}

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
