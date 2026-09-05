"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Loader2, Save, Plus, Pencil, Trash2, PackagePlus, ImagePlus, X } from "lucide-react";
import {
  upsertProduct,
  deleteProduct,
  adjustStock,
} from "@/app/actions/settings";
import type { ProductTarget } from "@/generated/prisma/enums";
import { formatBaht } from "@/lib/format";
import { fileToDataUrl } from "@/lib/file";
import { cn } from "@/lib/utils";
import { useI18n } from "@/components/i18n-provider";
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
  imageUrl: string | null;
};

const empty = {
  name: "",
  target: "PET" as ProductTarget,
  category: "",
  price: "",
  cost: "",
  unit: "ชิ้น",
  stockQty: "",
  imageUrl: "",
};

export function StockManager({ products }: { products: Product[] }) {
  const { t } = useI18n();
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Product | null>(null);
  const [form, setForm] = useState(empty);

  const [uploading, setUploading] = useState(false);

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
      imageUrl: p.imageUrl ?? "",
    });
    setOpen(true);
  }

  async function handleImage(file: File | undefined) {
    if (!file) return;
    setUploading(true);
    try {
      // จำกัด 1MB เพราะรูปถูกเก็บเป็น data URL ลงฐานข้อมูลโดยตรง (แนวเดียวกับรูปสัตว์เลี้ยง)
      setForm((prev) => ({ ...prev, imageUrl: "" }));
      const dataUrl = await fileToDataUrl(file, 1024 * 1024);
      setForm((prev) => ({ ...prev, imageUrl: dataUrl }));
    } catch (e) {
      toast.error(e instanceof Error ? e.message : t.settings.stock.uploadFailed);
    } finally {
      setUploading(false);
    }
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
        imageUrl: form.imageUrl || null,
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
    if (!confirm(t.settings.stock.confirmDelete)) return;
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
          <Plus /> {t.settings.stock.addProduct}
        </Button>
      </div>

      <Card>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="border-b bg-muted/50 text-muted-foreground">
                <tr>
                  <th className="px-4 py-2 text-left font-medium">{t.settings.stock.columnProduct}</th>
                  <th className="px-4 py-2 text-left font-medium">{t.settings.stock.columnCategory}</th>
                  <th className="px-4 py-2 text-right font-medium">{t.settings.stock.columnPrice}</th>
                  <th className="px-4 py-2 text-center font-medium">{t.settings.stock.columnStock}</th>
                  <th className="px-4 py-2 text-right font-medium">{t.settings.stock.columnActions}</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {products.map((p) => (
                  <tr key={p.id}>
                    <td className="px-4 py-2">
                      <div className="flex items-center gap-3">
                        {p.imageUrl ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={p.imageUrl}
                            alt=""
                            className="h-10 w-10 shrink-0 rounded-md border object-cover"
                          />
                        ) : (
                          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md border bg-muted/50">
                            <ImagePlus className="h-4 w-4 text-muted-foreground/40" />
                          </div>
                        )}
                        <div>
                          <div className="font-medium">{p.name}</div>
                          <Badge variant="secondary" className="mt-0.5 text-[10px]">
                            {t.labels.productTarget[p.target]}
                          </Badge>
                        </div>
                      </div>
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
                          title={t.settings.stock.adjustStock}
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
                      {t.settings.stock.empty}
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
            <DialogTitle>{editing ? t.settings.stock.editProduct : t.settings.stock.addProduct}</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 sm:grid-cols-2">
            {/* รูปสินค้า — เก็บเป็น data URL เหมือนรูปสัตว์เลี้ยง แล้วไปโชว์บนการ์ดหน้าร้านอาหาร */}
            <div className="space-y-2 sm:col-span-2">
              <Label>{t.settings.stock.imageLabel}</Label>
              <div className="flex items-center gap-3">
                {form.imageUrl ? (
                  <div className="relative w-fit">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={form.imageUrl}
                      alt=""
                      className="h-24 w-24 rounded-lg border object-cover"
                    />
                    <button
                      type="button"
                      onClick={() => setForm({ ...form, imageUrl: "" })}
                      aria-label={t.common.delete}
                      className="absolute -top-2 -right-2 flex h-6 w-6 items-center justify-center rounded-full border bg-background text-muted-foreground shadow-sm hover:text-destructive"
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </div>
                ) : (
                  <label className="flex h-24 w-24 cursor-pointer flex-col items-center justify-center gap-1.5 rounded-lg border border-dashed text-xs text-muted-foreground transition-colors hover:bg-accent/50">
                    {uploading ? (
                      <Loader2 className="h-5 w-5 animate-spin" />
                    ) : (
                      <>
                        <ImagePlus className="h-5 w-5" />
                        {t.settings.stock.uploadImage}
                      </>
                    )}
                    <input
                      type="file"
                      accept="image/*"
                      className="hidden"
                      disabled={uploading}
                      onChange={(e) => handleImage(e.target.files?.[0])}
                    />
                  </label>
                )}
                <p className="text-xs text-muted-foreground">{t.settings.stock.imageHint}</p>
              </div>
            </div>
            <div className="space-y-2 sm:col-span-2">
              <Label>{t.settings.stock.productNameLabel}</Label>
              <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label>{t.settings.stock.targetLabel}</Label>
              <Select
                value={form.target}
                onValueChange={(v) => setForm({ ...form, target: v as ProductTarget })}
                items={{ PET: t.settings.stock.targetPet, HUMAN: t.settings.stock.targetHuman }}
              >
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="PET">{t.settings.stock.targetPet}</SelectItem>
                  <SelectItem value="HUMAN">{t.settings.stock.targetHuman}</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>{t.common.category}</Label>
              <Input
                value={form.category}
                onChange={(e) => setForm({ ...form, category: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label>{t.settings.stock.priceSellLabel}</Label>
              <Input
                type="number"
                value={form.price}
                onChange={(e) => setForm({ ...form, price: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label>{t.settings.stock.costLabel}</Label>
              <Input
                type="number"
                value={form.cost}
                onChange={(e) => setForm({ ...form, cost: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label>{t.settings.stock.unitLabel}</Label>
              <Input value={form.unit} onChange={(e) => setForm({ ...form, unit: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label>{t.settings.stock.stockQtyLabel}</Label>
              <Input
                type="number"
                value={form.stockQty}
                onChange={(e) => setForm({ ...form, stockQty: e.target.value })}
              />
            </div>
          </div>
          <DialogFooter>
            <Button onClick={save} disabled={isPending || !form.name}>
              {isPending ? <Loader2 className="animate-spin" /> : <Save />}
              {t.common.save}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Adjust stock dialog */}
      <Dialog open={!!adjustFor} onOpenChange={(o) => !o && setAdjustFor(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t.settings.stock.adjustTitle(adjustFor?.name ?? "")}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>{t.settings.stock.targetLabel}</Label>
              <Select
                value={adjustType}
                onValueChange={(v) => setAdjustType(v as "IN" | "OUT" | "ADJUST")}
                items={{
                  IN: t.settings.stock.adjustTypeInFull,
                  OUT: t.settings.stock.adjustTypeOutFull,
                  ADJUST: t.settings.stock.adjustTypeSet,
                }}
              >
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="IN">{t.settings.stock.adjustTypeInFull}</SelectItem>
                  <SelectItem value="OUT">{t.settings.stock.adjustTypeOutFull}</SelectItem>
                  <SelectItem value="ADJUST">{t.settings.stock.adjustTypeSet}</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>{t.settings.stock.quantityLabel}</Label>
              <Input
                type="number"
                value={adjustQty}
                onChange={(e) => setAdjustQty(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button onClick={doAdjust} disabled={isPending || !adjustQty}>
              {isPending ? <Loader2 className="animate-spin" /> : <Save />}
              {t.common.save}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
