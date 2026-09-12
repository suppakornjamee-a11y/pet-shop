"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Loader2, Save, Plus, Pencil, Trash2, Wind, Fan, Camera, Search } from "lucide-react";
import { upsertRoom, deleteRoom } from "@/app/actions/settings";
import type { RoomSize, BillingUnit } from "@/generated/prisma/enums";
import { formatBaht } from "@/lib/format";
import { useI18n } from "@/components/i18n-provider";
import { useConfirm } from "@/components/confirm-provider";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Card, CardContent } from "@/components/ui/card";
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
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

type Category = {
  id: string;
  name: string;
  billingUnit: BillingUnit;
  active: boolean;
};

type Room = {
  id: string;
  categoryId: string;
  categoryName: string;
  billingUnit: BillingUnit;
  name: string;
  sortOrder: number;
  size: RoomSize | null;
  hasAir: boolean;
  hasFan: boolean;
  hasCctv: boolean;
  cctvModel: string | null;
  cctvSerial: string | null;
  pricePerNight: number;
  equipment: string | null;
  description: string | null;
  active: boolean;
};

const NO_SIZE = "__none__";

const emptyForm = (categoryId: string) => ({
  categoryId,
  name: "",
  sortOrder: "0",
  size: NO_SIZE,
  hasAir: false,
  hasFan: false,
  hasCctv: false,
  cctvModel: "",
  cctvSerial: "",
  pricePerNight: "",
  equipment: "",
  description: "",
});

export function RoomManager({ categories, rooms }: { categories: Category[]; rooms: Room[] }) {
  const { t } = useI18n();
  const confirm = useConfirm();
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Room | null>(null);
  const [form, setForm] = useState(emptyForm(categories[0]?.id ?? ""));

  const [query, setQuery] = useState("");
  const [showInactive, setShowInactive] = useState(true);

  const inactiveCount = useMemo(() => rooms.filter((r) => !r.active).length, [rooms]);

  const grouped = useMemo(() => {
    const q = query.trim().toLowerCase();
    const map = new Map<string, Room[]>();
    for (const r of rooms) {
      if (!showInactive && !r.active) continue;
      if (q && !r.name.toLowerCase().includes(q)) continue;
      (map.get(r.categoryId) ?? map.set(r.categoryId, []).get(r.categoryId)!).push(r);
    }
    const all = categories.map((c) => ({ category: c, rooms: map.get(c.id) ?? [] }));
    // ตอนค้นหา ซ่อนหมวดที่ไม่มีห้องตรงเลย จะได้ไม่ต้องเลื่อนผ่านหมวดว่างเปล่าทีละหมวด
    return q || !showInactive ? all.filter((g) => g.rooms.length > 0) : all;
  }, [categories, rooms, query, showInactive]);

  const shownCount = useMemo(
    () => grouped.reduce((sum, g) => sum + g.rooms.length, 0),
    [grouped]
  );

  function openNew(categoryId?: string) {
    setEditing(null);
    setForm(emptyForm(categoryId ?? categories[0]?.id ?? ""));
    setOpen(true);
  }
  function openEdit(r: Room) {
    setEditing(r);
    setForm({
      categoryId: r.categoryId,
      name: r.name,
      sortOrder: String(r.sortOrder),
      size: r.size ?? NO_SIZE,
      hasAir: r.hasAir,
      hasFan: r.hasFan,
      hasCctv: r.hasCctv,
      cctvModel: r.cctvModel ?? "",
      cctvSerial: r.cctvSerial ?? "",
      pricePerNight: String(r.pricePerNight),
      equipment: r.equipment ?? "",
      description: r.description ?? "",
    });
    setOpen(true);
  }

  function save() {
    startTransition(async () => {
      const res = await upsertRoom({
        id: editing?.id,
        categoryId: form.categoryId,
        name: form.name,
        sortOrder: Number(form.sortOrder || 0),
        size: form.size === NO_SIZE ? undefined : form.size,
        hasAir: form.hasAir,
        hasFan: form.hasFan,
        hasCctv: form.hasCctv,
        cctvModel: form.cctvModel || undefined,
        cctvSerial: form.cctvSerial || undefined,
        pricePerNight: Number(form.pricePerNight || 0),
        equipment: form.equipment || undefined,
        description: form.description || undefined,
        active: true,
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
    if (!(await confirm({ title: t.settings.rooms.confirmDelete, tone: "danger" }))) return;
    startTransition(async () => {
      const res = await deleteRoom(id);
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
      {/* ค้นหาค้างไว้บนสุด — มีหลายสิบห้องกระจายหลายหมวด เลื่อนหาเองเสียเวลา
          ส่วนการเพิ่มห้องใช้ปุ่มในหัวหมวด ซึ่งเลือกหมวดให้ล่วงหน้าอยู่แล้ว */}
      {categories.length > 0 && (
        <div className="sticky top-16 z-10 -mx-1 flex flex-wrap items-center gap-2 bg-background/95 px-1 py-2 backdrop-blur">
          <div className="relative min-w-0 flex-1">
            <Search className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={t.settings.rooms.searchPlaceholder}
              className="pl-9"
            />
          </div>
          {inactiveCount > 0 && (
            <label className="flex shrink-0 cursor-pointer items-center gap-2 text-xs text-muted-foreground">
              <Switch checked={showInactive} onCheckedChange={setShowInactive} />
              {t.settings.rooms.showInactive}
            </label>
          )}
        </div>
      )}

      {categories.length === 0 && (
        <p className="text-sm text-muted-foreground">
          {t.settings.rooms.noCategoriesHint}
        </p>
      )}

      {grouped.map(({ category, rooms: roomsInCategory }) => (
        <div key={category.id} className="space-y-3">
          <div className="flex items-center gap-2 border-b pb-1.5">
            <h3 className="text-sm font-semibold">{category.name}</h3>
            <Badge variant="secondary" className="text-[10px] font-normal">
              {t.labels.billingUnit[category.billingUnit]}
            </Badge>
            <Badge variant="secondary" className="text-[10px] font-normal">
              {t.settings.rooms.countBadge(roomsInCategory.length)}
            </Badge>
            <Button
              variant="ghost"
              size="sm"
              className="ml-auto h-7 text-xs text-muted-foreground"
              onClick={() => openNew(category.id)}
            >
              <Plus className="h-3.5 w-3.5" /> {t.settings.rooms.addRoomInCategory}
            </Button>
          </div>
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {roomsInCategory.map((r) => (
              <Card key={r.id} className={!r.active ? "opacity-50" : undefined}>
                <CardContent className="space-y-2 py-2.5">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-baseline justify-between gap-2">
                        <span className="truncate font-semibold">{r.name}</span>
                        <span className="shrink-0 text-sm font-semibold text-primary">
                          {formatBaht(r.pricePerNight)}
                          <span className="ml-1 text-[10px] font-normal text-muted-foreground">
                            {t.labels.billingUnit[r.billingUnit]}
                          </span>
                        </span>
                      </div>
                      <div className="flex flex-wrap items-center gap-1 pt-1.5">
                        {r.size && (
                          <Badge variant="secondary" className="text-[10px]">
                            {t.labels.roomSize[r.size]}
                          </Badge>
                        )}
                        {!r.active && (
                          <Badge variant="outline" className="text-[10px]">
                            {t.common.inactive}
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
                        onClick={() => openEdit(r)}
                      >
                        <Pencil className="h-3.5 w-3.5" />
                      </Button>
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-7 w-7"
                        aria-label={t.common.delete}
                        onClick={() => remove(r.id)}
                      >
                        <Trash2 className="h-3.5 w-3.5 text-destructive" />
                      </Button>
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-1.5 text-xs">
                    {r.hasAir && (
                      <Badge variant="outline" className="gap-1">
                        <Wind className="h-3 w-3" /> {t.settings.rooms.hasAir}
                      </Badge>
                    )}
                    {r.hasFan && (
                      <Badge variant="outline" className="gap-1">
                        <Fan className="h-3 w-3" /> {t.settings.rooms.hasFan}
                      </Badge>
                    )}
                    {r.hasCctv && (
                      <Badge variant="outline" className="gap-1">
                        <Camera className="h-3 w-3" /> CCTV
                        {r.cctvModel ? ` · ${r.cctvModel}` : ""}
                      </Badge>
                    )}
                    {r.equipment
                      ?.split(",")
                      .filter(Boolean)
                      .map((e) => (
                        <Badge key={e} variant="outline">
                          {e.trim()}
                        </Badge>
                      ))}
                  </div>
                </CardContent>
              </Card>
            ))}
            {roomsInCategory.length === 0 && (
              <p className="text-sm text-muted-foreground">{t.settings.rooms.noRoomsInCategory}</p>
            )}
          </div>
        </div>
      ))}

      {categories.length > 0 && rooms.length > 0 && shownCount === 0 && (
        <p className="py-10 text-center text-sm text-muted-foreground">
          {t.settings.rooms.noMatches}
        </p>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editing ? t.settings.rooms.editRoom : t.settings.rooms.addRoom}</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2 sm:col-span-2">
              <Label>{t.settings.rooms.categoryLabel}</Label>
              <Select
                value={form.categoryId}
                onValueChange={(v) => setForm({ ...form, categoryId: v ?? "" })}
                items={Object.fromEntries(categories.map((c) => [c.id, c.name]))}
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder={t.settings.rooms.selectCategory} />
                </SelectTrigger>
                <SelectContent>
                  <SelectGroup>
                    <SelectLabel>{t.common.category}</SelectLabel>
                    {categories.map((c) => (
                      <SelectItem key={c.id} value={c.id}>
                        {c.name}
                      </SelectItem>
                    ))}
                  </SelectGroup>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>{t.settings.rooms.unitNameLabel}</Label>
              <Input
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label>{t.settings.rooms.sortOrderLabel}</Label>
              <Input
                type="number"
                value={form.sortOrder}
                onChange={(e) => setForm({ ...form, sortOrder: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label>{t.settings.rooms.sizeLabel}</Label>
              <Select
                value={form.size}
                onValueChange={(v) => setForm({ ...form, size: v ?? NO_SIZE })}
                items={{
                  [NO_SIZE]: t.settings.rooms.noSize,
                  SMALL: t.settings.rooms.sizeSmall,
                  MEDIUM: t.settings.rooms.sizeMedium,
                  LARGE: t.settings.rooms.sizeLarge,
                  XLARGE: t.settings.rooms.sizeXLarge,
                }}
              >
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={NO_SIZE}>{t.settings.rooms.noSize}</SelectItem>
                  <SelectItem value="SMALL">{t.settings.rooms.sizeSmall}</SelectItem>
                  <SelectItem value="MEDIUM">{t.settings.rooms.sizeMedium}</SelectItem>
                  <SelectItem value="LARGE">{t.settings.rooms.sizeLarge}</SelectItem>
                  <SelectItem value="XLARGE">{t.settings.rooms.sizeXLarge}</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>{t.settings.rooms.priceLabel}</Label>
              <Input
                type="number"
                value={form.pricePerNight}
                onChange={(e) => setForm({ ...form, pricePerNight: e.target.value })}
              />
            </div>
            <div className="flex items-center gap-4">
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={form.hasAir}
                  onChange={(e) => setForm({ ...form, hasAir: e.target.checked })}
                  className="h-4 w-4 accent-primary"
                />
                {t.settings.rooms.hasAirCheckbox}
              </label>
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={form.hasFan}
                  onChange={(e) => setForm({ ...form, hasFan: e.target.checked })}
                  className="h-4 w-4 accent-primary"
                />
                {t.settings.rooms.hasFanCheckbox}
              </label>
            </div>
            <div className="flex items-center sm:col-span-2">
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={form.hasCctv}
                  onChange={(e) => setForm({ ...form, hasCctv: e.target.checked })}
                  className="h-4 w-4 accent-primary"
                />
                {t.settings.rooms.hasCctvCheckbox}
              </label>
            </div>
            {form.hasCctv && (
              <>
                <div className="space-y-2">
                  <Label>{t.settings.rooms.cctvModelLabel}</Label>
                  <Input
                    value={form.cctvModel}
                    onChange={(e) => setForm({ ...form, cctvModel: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label>{t.settings.rooms.cctvSerialLabel}</Label>
                  <Input
                    value={form.cctvSerial}
                    onChange={(e) => setForm({ ...form, cctvSerial: e.target.value })}
                  />
                </div>
              </>
            )}
            <div className="space-y-2 sm:col-span-2">
              <Label>{t.settings.rooms.tagsLabel}</Label>
              <Input
                value={form.equipment}
                onChange={(e) => setForm({ ...form, equipment: e.target.value })}
              />
            </div>
          </div>
          <DialogFooter>
            <Button onClick={save} disabled={isPending || !form.name || !form.categoryId}>
              {isPending ? <Loader2 className="animate-spin" /> : <Save />}
              {t.common.save}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
