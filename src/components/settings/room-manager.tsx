"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Loader2, Plus, Pencil, Trash2, Wind, Fan } from "lucide-react";
import { upsertRoom, deleteRoom } from "@/app/actions/settings";
import type { RoomSize, BillingUnit } from "@/generated/prisma/enums";
import { formatBaht } from "@/lib/format";
import { roomSizeLabel, billingUnitLabel } from "@/lib/labels";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
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
  pricePerNight: "",
  equipment: "",
  description: "",
});

export function RoomManager({ categories, rooms }: { categories: Category[]; rooms: Room[] }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Room | null>(null);
  const [form, setForm] = useState(emptyForm(categories[0]?.id ?? ""));

  const grouped = useMemo(() => {
    const map = new Map<string, Room[]>();
    for (const r of rooms) {
      const list = map.get(r.categoryId) ?? [];
      list.push(r);
      map.set(r.categoryId, list);
    }
    return categories.map((c) => ({ category: c, rooms: map.get(c.id) ?? [] }));
  }, [categories, rooms]);

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

  function remove(id: string) {
    if (!confirm("ลบห้องนี้?")) return;
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
      <div className="flex justify-end">
        <Button onClick={() => openNew()} disabled={categories.length === 0}>
          <Plus /> เพิ่มห้อง/พื้นที่
        </Button>
      </div>

      {categories.length === 0 && (
        <p className="text-sm text-muted-foreground">
          ยังไม่มีหมวดหมู่ — ไปที่แท็บ &quot;หมวดหมู่&quot; เพื่อสร้างก่อน
        </p>
      )}

      {grouped.map(({ category, rooms: roomsInCategory }) => (
        <div key={category.id} className="space-y-3">
          <div className="flex items-center gap-2">
            <h3 className="text-sm font-semibold">{category.name}</h3>
            <Badge variant="secondary" className="text-[10px]">
              {billingUnitLabel[category.billingUnit]}
            </Badge>
            <Button variant="ghost" size="sm" className="h-6 px-2 text-xs" onClick={() => openNew(category.id)}>
              <Plus className="h-3 w-3" /> เพิ่มในหมวดนี้
            </Button>
          </div>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {roomsInCategory.map((r) => (
              <Card key={r.id}>
                <CardContent className="space-y-3 py-2">
                  <div className="flex items-start justify-between">
                    <div>
                      <div className="text-lg font-bold">{r.name}</div>
                      {r.size && (
                        <Badge variant="secondary" className="text-[10px]">
                          {roomSizeLabel[r.size]}
                        </Badge>
                      )}
                    </div>
                    <div className="text-right">
                      <div className="font-bold text-primary">{formatBaht(r.pricePerNight)}</div>
                      <div className="text-[10px] text-muted-foreground">
                        {billingUnitLabel[r.billingUnit]}
                      </div>
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-1.5 text-xs">
                    {r.hasAir && (
                      <Badge variant="outline" className="gap-1">
                        <Wind className="h-3 w-3" /> แอร์
                      </Badge>
                    )}
                    {r.hasFan && (
                      <Badge variant="outline" className="gap-1">
                        <Fan className="h-3 w-3" /> พัดลม
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
                  <div className="flex justify-end gap-1">
                    <Button size="sm" variant="ghost" onClick={() => openEdit(r)}>
                      <Pencil className="h-4 w-4" /> แก้ไข
                    </Button>
                    <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => remove(r.id)}>
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
            {roomsInCategory.length === 0 && (
              <p className="text-sm text-muted-foreground">ยังไม่มีห้อง/พื้นที่ในหมวดนี้</p>
            )}
          </div>
        </div>
      ))}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editing ? "แก้ไขห้อง/พื้นที่" : "เพิ่มห้อง/พื้นที่"}</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2 sm:col-span-2">
              <Label>หมวดหมู่ *</Label>
              <Select
                value={form.categoryId}
                onValueChange={(v) => setForm({ ...form, categoryId: v ?? "" })}
                items={Object.fromEntries(categories.map((c) => [c.id, c.name]))}
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="เลือกหมวดหมู่" />
                </SelectTrigger>
                <SelectContent>
                  <SelectGroup>
                    <SelectLabel>หมวดหมู่</SelectLabel>
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
              <Label>ชื่อ/เลขยูนิต *</Label>
              <Input
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="เช่น 1 (คอกเบอร์ 5), Small Dog เลนที่ 1"
              />
            </div>
            <div className="space-y-2">
              <Label>ลำดับการแสดงผล</Label>
              <Input
                type="number"
                value={form.sortOrder}
                onChange={(e) => setForm({ ...form, sortOrder: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label>ขนาด (ถ้ามี)</Label>
              <Select
                value={form.size}
                onValueChange={(v) => setForm({ ...form, size: v ?? NO_SIZE })}
                items={{
                  [NO_SIZE]: "ไม่ระบุ",
                  SMALL: "เล็ก (S)",
                  MEDIUM: "กลาง (M)",
                  LARGE: "ใหญ่ (L)",
                  XLARGE: "ใหญ่พิเศษ (XL)",
                }}
              >
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={NO_SIZE}>ไม่ระบุ</SelectItem>
                  <SelectItem value="SMALL">เล็ก (S)</SelectItem>
                  <SelectItem value="MEDIUM">กลาง (M)</SelectItem>
                  <SelectItem value="LARGE">ใหญ่ (L)</SelectItem>
                  <SelectItem value="XLARGE">ใหญ่พิเศษ (XL)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>ราคา (บาท) *</Label>
              <Input
                type="number"
                value={form.pricePerNight}
                onChange={(e) => setForm({ ...form, pricePerNight: e.target.value })}
              />
            </div>
            <div className="flex items-end gap-4">
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={form.hasAir}
                  onChange={(e) => setForm({ ...form, hasAir: e.target.checked })}
                  className="h-4 w-4 accent-primary"
                />
                มีแอร์
              </label>
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={form.hasFan}
                  onChange={(e) => setForm({ ...form, hasFan: e.target.checked })}
                  className="h-4 w-4 accent-primary"
                />
                มีพัดลม
              </label>
            </div>
            <div className="space-y-2 sm:col-span-2">
              <Label>แท็ก/หมายเหตุราคาเพิ่ม (คั่นด้วยจุลภาค)</Label>
              <Input
                value={form.equipment}
                onChange={(e) => setForm({ ...form, equipment: e.target.value })}
                placeholder="เช่น คอกบน,มีกล้องวงจรปิด,+50"
              />
            </div>
          </div>
          <DialogFooter>
            <Button onClick={save} disabled={isPending || !form.name || !form.categoryId}>
              {isPending ? <Loader2 className="animate-spin" /> : <Plus />}
              บันทึก
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
