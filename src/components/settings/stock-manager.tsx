"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Loader2, Plus, Pencil, Trash2, PackagePlus } from "lucide-react";
import {
  upsertProduct,
  deleteProduct,
  adjustStock,
} from "@/app/actions/settings";
import type { ProductTarget } from "@/generated/prisma/enums";
import { formatBaht } from "@/lib/format";
import { productTargetLabel } from "@/lib/labels";
import { cn } from "@/lib/utils";
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
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

type Product = {
  id: string;
  name: string;
  target: ProductTarget;
  category: string | null;
  price: number;
  cost: number | null;
  unit: string;
  stockQty: number;
  active: boolean;
};

const empty = {
  name: "",
  target: "PET" as ProductTarget,
  category: "",
  price: "",
  cost: "",
  unit: "ชิ้น",
  stockQty: "",
};

export function StockManager({ products }: { products: Product[] }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Product | null>(null);
  const [form, setForm] = useState(empty);

  const [adjustFor, setAdjustFor] = useState<Product | null>(null);
  const [adjustQty, setAdjustQty] = useState("");
  const [adjustType, setAdjustType] = useState<"IN" | "OUT" | "ADJUST">("IN");

  function openNew() {
    setEditing(null);
    setForm(empty);
    setOpen(true);
  }
  function openEdit(p: Product) {
    setEditing(p);
    setForm({
      name: p.name,
      target: p.target,
      category: p.category ?? "",
      price: String(p.price),
      cost: p.cost != null ? String(p.cost) : "",
      unit: p.unit,
      stockQty: String(p.stockQty),
    });
    setOpen(true);
  }

  function save() {
    startTransition(async () => {
      const res = await upsertProduct({
        id: editing?.id,
        name: form.name,
        target: form.target,
        category: form.category || undefined,
        price: Number(form.price || 0),
        cost: form.cost ? Number(form.cost) : undefined,
        unit: form.unit || "ชิ้น",
        stockQty: Number(form.stockQty || 0),
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
    if (!confirm("ลบสินค้านี้?")) return;
    startTransition(async () => {
      const res = await deleteProduct(id);
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      toast.success(res.message);
      router.refresh();
    });
  }

  function doAdjust() {
    if (!adjustFor) return;
    startTransition(async () => {
      const res = await adjustStock({
        productId: adjustFor.id,
        type: adjustType,
        quantity: Number(adjustQty || 0),
      });
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      toast.success(res.message);
      setAdjustFor(null);
      setAdjustQty("");
      router.refresh();
    });
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Button onClick={openNew}>
          <Plus /> เพิ่มสินค้า
        </Button>
      </div>

      <Card>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="border-b bg-muted/50 text-muted-foreground">
                <tr>
                  <th className="px-4 py-2 text-left font-medium">สินค้า</th>
                  <th className="px-4 py-2 text-left font-medium">หมวด</th>
                  <th className="px-4 py-2 text-right font-medium">ราคา</th>
                  <th className="px-4 py-2 text-center font-medium">คงเหลือ</th>
                  <th className="px-4 py-2 text-right font-medium">จัดการ</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {products.map((p) => (
                  <tr key={p.id}>
                    <td className="px-4 py-2">
                      <div className="font-medium">{p.name}</div>
                      <Badge variant="secondary" className="mt-0.5 text-[10px]">
                        {productTargetLabel[p.target]}
                      </Badge>
                    </td>
                    <td className="px-4 py-2 text-muted-foreground">{p.category ?? "-"}</td>
                    <td className="px-4 py-2 text-right">{formatBaht(p.price)}</td>
                    <td className="px-4 py-2 text-center">
                      <span
                        className={cn(
                          "font-medium",
                          p.stockQty <= 5 && "text-rose-600"
                        )}
                      >
                        {p.stockQty}
                      </span>{" "}
                      <span className="text-xs text-muted-foreground">{p.unit}</span>
                    </td>
                    <td className="px-4 py-2">
                      <div className="flex justify-end gap-1">
                        <Button
                          size="icon"
                          variant="ghost"
                          className="h-8 w-8"
                          onClick={() => setAdjustFor(p)}
                          title="ปรับสต็อก"
                        >
                          <PackagePlus className="h-4 w-4" />
                        </Button>
                        <Button
                          size="icon"
                          variant="ghost"
                          className="h-8 w-8"
                          onClick={() => openEdit(p)}
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          size="icon"
                          variant="ghost"
                          className="h-8 w-8"
                          onClick={() => remove(p.id)}
                        >
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
                {products.length === 0 && (
                  <tr>
                    <td colSpan={5} className="py-10 text-center text-muted-foreground">
                      ยังไม่มีสินค้า
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* Add/Edit dialog */}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editing ? "แก้ไขสินค้า" : "เพิ่มสินค้า"}</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2 sm:col-span-2">
              <Label>ชื่อสินค้า *</Label>
              <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label>ประเภท</Label>
              <Select
                value={form.target}
                onValueChange={(v) => setForm({ ...form, target: v as ProductTarget })}
                items={{ PET: "ของสัตว์", HUMAN: "ของคน (คาเฟ่)" }}
              >
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="PET">ของสัตว์</SelectItem>
                  <SelectItem value="HUMAN">ของคน (คาเฟ่)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>หมวดหมู่</Label>
              <Input
                value={form.category}
                onChange={(e) => setForm({ ...form, category: e.target.value })}
                placeholder="เช่น ขนม, อาหารเปียก"
              />
            </div>
            <div className="space-y-2">
              <Label>ราคาขาย (บาท) *</Label>
              <Input
                type="number"
                value={form.price}
                onChange={(e) => setForm({ ...form, price: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label>ต้นทุน (บาท)</Label>
              <Input
                type="number"
                value={form.cost}
                onChange={(e) => setForm({ ...form, cost: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label>หน่วย</Label>
              <Input value={form.unit} onChange={(e) => setForm({ ...form, unit: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label>จำนวนคงเหลือ</Label>
              <Input
                type="number"
                value={form.stockQty}
                onChange={(e) => setForm({ ...form, stockQty: e.target.value })}
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

      {/* Adjust stock dialog */}
      <Dialog open={!!adjustFor} onOpenChange={(o) => !o && setAdjustFor(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>ปรับสต็อก · {adjustFor?.name}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>ประเภท</Label>
              <Select
                value={adjustType}
                onValueChange={(v) => setAdjustType(v as "IN" | "OUT" | "ADJUST")}
                items={{ IN: "รับเข้า (+)", OUT: "ตัดออก (−)", ADJUST: "ตั้งค่าเป็นจำนวน" }}
              >
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="IN">รับเข้า (+)</SelectItem>
                  <SelectItem value="OUT">ตัดออก (−)</SelectItem>
                  <SelectItem value="ADJUST">ตั้งค่าเป็นจำนวน</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>จำนวน</Label>
              <Input
                type="number"
                value={adjustQty}
                onChange={(e) => setAdjustQty(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button onClick={doAdjust} disabled={isPending || !adjustQty}>
              {isPending ? <Loader2 className="animate-spin" /> : <PackagePlus />}
              บันทึก
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
