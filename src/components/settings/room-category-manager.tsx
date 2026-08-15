"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Loader2, Plus, Pencil, Trash2 } from "lucide-react";
import { upsertRoomCategory, deleteRoomCategory } from "@/app/actions/settings";
import type { BillingUnit } from "@/generated/prisma/enums";
import { billingUnitLabel } from "@/lib/labels";
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

type RoomCategoryRow = {
  id: string;
  name: string;
  billingUnit: BillingUnit;
  sortOrder: number;
  description: string | null;
  active: boolean;
};

const empty = {
  name: "",
  billingUnit: "PER_NIGHT" as BillingUnit,
  sortOrder: "0",
  description: "",
};

export function RoomCategoryManager({ categories }: { categories: RoomCategoryRow[] }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<RoomCategoryRow | null>(null);
  const [form, setForm] = useState(empty);

  function openNew() {
    setEditing(null);
    setForm(empty);
    setOpen(true);
  }
  function openEdit(c: RoomCategoryRow) {
    setEditing(c);
    setForm({
      name: c.name,
      billingUnit: c.billingUnit,
      sortOrder: String(c.sortOrder),
      description: c.description ?? "",
    });
    setOpen(true);
  }

  function save() {
    startTransition(async () => {
      const res = await upsertRoomCategory({
        id: editing?.id,
        name: form.name,
        billingUnit: form.billingUnit,
        sortOrder: Number(form.sortOrder || 0),
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
    if (!confirm("ลบหมวดหมู่นี้?")) return;
    startTransition(async () => {
      const res = await deleteRoomCategory(id);
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
          <Plus /> เพิ่มหมวดหมู่
        </Button>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {categories.map((c) => (
          <Card key={c.id}>
            <CardContent className="space-y-3 py-2">
              <div className="flex items-start justify-between">
                <div className="text-lg font-bold">{c.name}</div>
                <Badge variant="secondary" className="text-[10px]">
                  {billingUnitLabel[c.billingUnit]}
                </Badge>
              </div>
              {c.description && (
                <p className="text-xs text-muted-foreground">{c.description}</p>
              )}
              <div className="flex justify-end gap-1">
                <Button size="sm" variant="ghost" onClick={() => openEdit(c)}>
                  <Pencil className="h-4 w-4" /> แก้ไข
                </Button>
                <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => remove(c.id)}>
                  <Trash2 className="h-4 w-4 text-destructive" />
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
        {categories.length === 0 && (
          <p className="text-sm text-muted-foreground">ยังไม่มีหมวดหมู่</p>
        )}
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editing ? "แก้ไขหมวดหมู่" : "เพิ่มหมวดหมู่"}</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2 sm:col-span-2">
              <Label>ชื่อหมวดหมู่ *</Label>
              <Input
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="เช่น Daycare, Nanny Room, BIG DOG"
              />
            </div>
            <div className="space-y-2">
              <Label>วิธีคิดราคา</Label>
              <Select
                value={form.billingUnit}
                onValueChange={(v) => setForm({ ...form, billingUnit: v as BillingUnit })}
                items={{ PER_NIGHT: "ต่อคืน", PER_VISIT: "ต่อครั้ง" }}
              >
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="PER_NIGHT">ต่อคืน (ค้างคืน)</SelectItem>
                  <SelectItem value="PER_VISIT">ต่อครั้ง (Daycare/ไป-กลับ)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>ลำดับการแสดงผล</Label>
              <Input
                type="number"
                value={form.sortOrder}
                onChange={(e) => setForm({ ...form, sortOrder: e.target.value })}
              />
            </div>
            <div className="space-y-2 sm:col-span-2">
              <Label>คำอธิบาย</Label>
              <Input
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
                placeholder="เช่น ห้องวิ่งเล่นสุนัข/แมวไซส์เล็ก"
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
