"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Loader2, Plus, Pencil, Trash2, Wind, Fan } from "lucide-react";
import { upsertRoom, deleteRoom } from "@/app/actions/settings";
import type { RoomSize } from "@/generated/prisma/enums";
import { formatBaht } from "@/lib/format";
import { roomSizeLabel } from "@/lib/labels";
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
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

type Room = {
  id: string;
  name: string;
  size: RoomSize;
  hasAir: boolean;
  hasFan: boolean;
  pricePerNight: number;
  equipment: string | null;
  description: string | null;
  active: boolean;
};

const empty = {
  name: "",
  size: "SMALL" as RoomSize,
  hasAir: false,
  hasFan: false,
  pricePerNight: "",
  equipment: "",
  description: "",
};

export function RoomManager({ rooms }: { rooms: Room[] }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Room | null>(null);
  const [form, setForm] = useState(empty);

  function openNew() {
    setEditing(null);
    setForm(empty);
    setOpen(true);
  }
  function openEdit(r: Room) {
    setEditing(r);
    setForm({
      name: r.name,
      size: r.size,
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
        name: form.name,
        size: form.size,
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
    <div className="space-y-4">
      <div className="flex justify-end">
        <Button onClick={openNew}>
          <Plus /> เพิ่มห้องพัก
        </Button>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {rooms.map((r) => (
          <Card key={r.id}>
            <CardContent className="space-y-3 py-2">
              <div className="flex items-start justify-between">
                <div>
                  <div className="text-lg font-bold">{r.name}</div>
                  <Badge variant="secondary" className="text-[10px]">
                    {roomSizeLabel[r.size]}
                  </Badge>
                </div>
                <div className="text-right">
                  <div className="font-bold text-primary">{formatBaht(r.pricePerNight)}</div>
                  <div className="text-[10px] text-muted-foreground">ต่อคืน</div>
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
        {rooms.length === 0 && (
          <p className="text-sm text-muted-foreground">ยังไม่มีห้องพัก</p>
        )}
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editing ? "แก้ไขห้องพัก" : "เพิ่มห้องพัก"}</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label>ชื่อ / เลขห้อง *</Label>
              <Input
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="เช่น A1, VIP-2"
              />
            </div>
            <div className="space-y-2">
              <Label>ขนาด</Label>
              <Select
                value={form.size}
                onValueChange={(v) => setForm({ ...form, size: v as RoomSize })}
                items={{
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
                  <SelectItem value="SMALL">เล็ก (S)</SelectItem>
                  <SelectItem value="MEDIUM">กลาง (M)</SelectItem>
                  <SelectItem value="LARGE">ใหญ่ (L)</SelectItem>
                  <SelectItem value="XLARGE">ใหญ่พิเศษ (XL)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>ราคาต่อคืน (บาท) *</Label>
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
              <Label>อุปกรณ์เสริม (คั่นด้วยจุลภาค)</Label>
              <Input
                value={form.equipment}
                onChange={(e) => setForm({ ...form, equipment: e.target.value })}
                placeholder="เช่น ที่นอน,ชามอาหาร,กล้องวงจรปิด"
              />
            </div>
          </div>
          <DialogFooter>
            <Button onClick={save} disabled={isPending || !form.name}>
              {isPending ? <Loader2 className="animate-spin" /> : <Plus />}
              บันทึก
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
