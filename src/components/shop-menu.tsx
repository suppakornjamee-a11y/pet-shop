"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Banknote, ImageIcon, Loader2, Minus, Plus, QrCode, ReceiptText } from "lucide-react";
import { createShopOrder } from "@/app/actions/shop";
import type { Dictionary } from "@/i18n/dictionaries/th";
import { formatBaht } from "@/lib/format";
import { useI18n } from "@/components/i18n-provider";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

export type ShopProduct = {
  id: string;
  name: string;
  category: string | null;
  price: number;
  unit: string;
  stockQty: number;
  imageUrl: string | null;
};

function ProductCard({
  product: p,
  qty,
  showStock,
  onStep,
  t,
}: {
  product: ShopProduct;
  qty: number;
  /** คาเฟ่คนทำสดตามออเดอร์ ไม่ต้องนับสต็อก — ซ่อนป้ายคงเหลือและไม่จำกัดจำนวนที่กดได้ */
  showStock: boolean;
  onStep: (product: ShopProduct, delta: number) => void;
  t: Dictionary;
}) {
  const soldOut = showStock && p.stockQty <= 0;
  return (
    <Card className="overflow-hidden py-0">
      {/* รูปสินค้า — ยังไม่แนบรูปก็เว้นเป็นช่องว่างไว้ (อัปโหลดได้ที่หน้ารายการสินค้า) */}
      <div className="flex aspect-[4/3] items-center justify-center overflow-hidden bg-muted/60">
        {p.imageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={p.imageUrl} alt={p.name} className="h-full w-full object-cover" />
        ) : (
          <ImageIcon className="h-8 w-8 text-muted-foreground/40" />
        )}
      </div>

      <CardContent className="space-y-2 p-3">
        <div>
          <div className="line-clamp-2 min-h-[2.5rem] text-sm leading-tight font-medium">
            {p.name}
          </div>
          <div className="mt-1 flex flex-wrap items-center gap-1">
            {p.category && (
              <Badge variant="secondary" className="text-[10px]">
                {p.category}
              </Badge>
            )}
            {showStock && (
              <Badge
                variant="outline"
                className={
                  soldOut
                    ? "border-red-300 text-[10px] text-red-600 dark:border-red-900 dark:text-red-400"
                    : "text-[10px]"
                }
              >
                {soldOut ? t.shop.soldOut : `${t.shop.stockLabel} ${p.stockQty} ${p.unit}`}
              </Badge>
            )}
          </div>
        </div>

        <div className="flex items-center justify-between gap-2">
          <span className="font-semibold tabular-nums">{formatBaht(p.price)}</span>
          <div className="flex items-center gap-1">
            <Button
              size="icon-sm"
              variant="outline"
              className="rounded-full"
              aria-label={t.shop.decrease}
              disabled={qty === 0}
              onClick={() => onStep(p, -1)}
            >
              <Minus />
            </Button>
            <span className="w-6 text-center text-sm tabular-nums">{qty}</span>
            <Button
              size="icon-sm"
              variant="outline"
              className="rounded-full"
              aria-label={t.shop.increase}
              disabled={soldOut || (showStock && qty >= p.stockQty)}
              onClick={() => onStep(p, 1)}
            >
              <Plus />
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function ProductGrid({
  products,
  qty,
  showStock,
  onStep,
  t,
}: {
  products: ShopProduct[];
  qty: Record<string, number>;
  showStock: boolean;
  onStep: (product: ShopProduct, delta: number) => void;
  t: Dictionary;
}) {
  if (products.length === 0) {
    return <p className="py-10 text-center text-sm text-muted-foreground">{t.shop.empty}</p>;
  }
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
      {products.map((p) => (
        <ProductCard
          key={p.id}
          product={p}
          qty={qty[p.id] ?? 0}
          showStock={showStock}
          onStep={onStep}
          t={t}
        />
      ))}
    </div>
  );
}

/** เมนูสั่งของหน้าร้าน — การ์ดสินค้าพร้อมปุ่มเพิ่ม/ลดจำนวน
 *  จำนวนที่เลือกเก็บไว้ที่ระดับนี้ (ไม่ใช่ในแต่ละแท็บ) จะได้สลับหมวดแล้วของที่เลือกไว้ไม่หาย */
export function ShopMenu({
  humanProducts,
  petProducts,
}: {
  humanProducts: ShopProduct[];
  petProducts: ShopProduct[];
}) {
  const { t } = useI18n();
  const router = useRouter();
  const [qty, setQty] = useState<Record<string, number>>({});
  const [billOpen, setBillOpen] = useState(false);
  const [isPending, startTransition] = useTransition();

  const summary = useMemo(() => {
    let count = 0;
    let total = 0;
    for (const p of [...humanProducts, ...petProducts]) {
      const n = qty[p.id] ?? 0;
      count += n;
      total += n * p.price;
    }
    return { count, total };
  }, [humanProducts, petProducts, qty]);

  // ของคนไม่นับสต็อก จึงกดเพิ่มได้ไม่จำกัด ส่วนของสัตว์กดได้ไม่เกินจำนวนคงเหลือ
  const stockTracked = useMemo(() => new Set(petProducts.map((p) => p.id)), [petProducts]);

  function step(p: ShopProduct, delta: number) {
    setQty((prev) => {
      const raw = Math.max((prev[p.id] ?? 0) + delta, 0);
      const next = stockTracked.has(p.id) ? Math.min(raw, Math.max(p.stockQty, 0)) : raw;
      return { ...prev, [p.id]: next };
    });
  }

  const selectedLines = [...humanProducts, ...petProducts]
    .map((p) => ({ product: p, quantity: qty[p.id] ?? 0 }))
    .filter((l) => l.quantity > 0);

  function openBill(paymentMethod: "CASH" | "PROMPTPAY") {
    startTransition(async () => {
      const res = await createShopOrder({
        items: selectedLines.map((l) => ({ productId: l.product.id, quantity: l.quantity })),
        paymentMethod,
      });
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      toast.success(res.message);
      setQty({});
      setBillOpen(false);
      // เงินสด = ปิดบิลแล้ว พาไปหน้าใบเสร็จให้ปริ้นต่อได้เลย
      // พร้อมเพย์ = ต้องรอสแกนจ่าย พาไปหน้าออเดอร์เพื่อดู QR และยืนยันสลิป
      router.push(paymentMethod === "CASH" ? `/print/orders/${res.orderId}` : `/orders/${res.orderId}`);
    });
  }

  return (
    <>
      {/* 2 หมวด: คาเฟ่คน (สินค้าสำหรับคน) และคาเฟ่สัตว์ (สินค้าสำหรับสัตว์เลี้ยง) */}
      <Tabs defaultValue="human">
        <TabsList>
          <TabsTrigger value="human">{t.shop.tabCafe}</TabsTrigger>
          <TabsTrigger value="pet">{t.shop.tabShop}</TabsTrigger>
        </TabsList>
        <TabsContent value="human" className="mt-4">
          <ProductGrid products={humanProducts} qty={qty} showStock={false} onStep={step} t={t} />
        </TabsContent>
        <TabsContent value="pet" className="mt-4">
          <ProductGrid products={petProducts} qty={qty} showStock onStep={step} t={t} />
        </TabsContent>
      </Tabs>

      {/* สรุปยอดที่เลือก — โผล่เมื่อเลือกอย่างน้อย 1 ชิ้น
          แสดงรายการที่เลือกไว้ด้วย พนักงานจะได้ทวนกับลูกค้าได้โดยไม่ต้องเปิดกล่องเปิดบิลก่อน */}
      {summary.count > 0 && (
        <div className="sticky bottom-4 mt-4">
          <Card>
            <CardContent className="space-y-2 py-3">
              <div className="max-h-44 space-y-1 overflow-y-auto text-sm">
                {selectedLines.map((l) => (
                  <div key={l.product.id} className="flex items-baseline justify-between gap-3">
                    <span className="min-w-0 truncate">
                      {l.product.name}
                      <span className="text-muted-foreground">
                        {" "}
                        x{l.quantity} {l.product.unit}
                      </span>
                    </span>
                    <span className="shrink-0 tabular-nums text-muted-foreground">
                      {formatBaht(l.product.price * l.quantity)}
                    </span>
                  </div>
                ))}
              </div>

              <div className="flex items-center justify-between gap-3 border-t pt-2">
                <span className="text-sm text-muted-foreground">
                  {t.shop.selectedCount(summary.count)}
                </span>
                <div className="flex items-center gap-3">
                  <span className="text-lg font-semibold tabular-nums">
                    {formatBaht(summary.total)}
                  </span>
                  <Button variant="outline" size="sm" onClick={() => setQty({})}>
                    {t.shop.clearSelection}
                  </Button>
                  <Button size="sm" onClick={() => setBillOpen(true)}>
                    <ReceiptText /> {t.shop.openBill}
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* เปิดบิล — สรุปรายการแล้วเลือกวิธีรับเงิน */}
      <Dialog open={billOpen} onOpenChange={setBillOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t.shop.openBill}</DialogTitle>
          </DialogHeader>

          <div className="max-h-64 space-y-1.5 overflow-y-auto text-sm">
            {selectedLines.map((l) => (
              <div key={l.product.id} className="flex items-baseline justify-between gap-3">
                <span className="min-w-0 truncate">
                  {l.product.name}
                  <span className="text-muted-foreground">
                    {" "}
                    x{l.quantity} {l.product.unit}
                  </span>
                </span>
                <span className="shrink-0 tabular-nums">
                  {formatBaht(l.product.price * l.quantity)}
                </span>
              </div>
            ))}
          </div>

          <div className="flex items-baseline justify-between border-t pt-3">
            <span className="font-medium">{t.shop.billTotal}</span>
            <span className="text-xl font-semibold tabular-nums">{formatBaht(summary.total)}</span>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              disabled={isPending}
              onClick={() => openBill("PROMPTPAY")}
            >
              {isPending ? <Loader2 className="animate-spin" /> : <QrCode />}
              {t.shop.payPromptpay}
            </Button>
            <Button disabled={isPending} onClick={() => openBill("CASH")}>
              {isPending ? <Loader2 className="animate-spin" /> : <Banknote />}
              {t.shop.payCash}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
