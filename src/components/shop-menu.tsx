"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { ImageIcon, Loader2, Minus, Plus, ReceiptText, Search, X } from "lucide-react";
import { createShopOrder } from "@/app/actions/shop";
import type { Dictionary } from "@/i18n/dictionaries/th";
import { formatBaht } from "@/lib/format";
import { cn } from "@/lib/utils";
import { useI18n } from "@/components/i18n-provider";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
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
  nameEn: string | null;
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
  locale,
}: {
  product: ShopProduct;
  qty: number;
  locale: string;
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
          <img src={p.imageUrl} alt={productName(p, locale)} className="h-full w-full object-cover" />
        ) : (
          <ImageIcon className="h-8 w-8 text-muted-foreground/40" />
        )}
      </div>

      <CardContent className="space-y-2 p-3">
        <div>
          <div className="line-clamp-2 min-h-[2.5rem] text-sm leading-tight font-medium">
            {productName(p, locale)}
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
  locale,
}: {
  products: ShopProduct[];
  qty: Record<string, number>;
  showStock: boolean;
  onStep: (product: ShopProduct, delta: number) => void;
  t: Dictionary;
  locale: string;
}) {
  if (products.length === 0) {
    return <p className="py-10 text-center text-sm text-muted-foreground">{t.shop.empty}</p>;
  }
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-4">
      {products.map((p) => (
        <ProductCard
          key={p.id}
          product={p}
          qty={qty[p.id] ?? 0}
          showStock={showStock}
          onStep={onStep}
          t={t}
          locale={locale}
        />
      ))}
    </div>
  );
}

/** ค่าที่ใช้แทน "หมวดอื่นๆ" ภายในคอมโพเนนต์ — สินค้าที่ไม่ได้ระบุหมวดจะถูกจัดไว้ตรงนี้
 *  ไม่งั้นจะหาไม่เจอเลยเมื่อเลือกหมวดใดหมวดหนึ่ง */
const UNCATEGORIZED = "__none__";

/** จำนวนการ์ดสูงสุดที่วาดพร้อมกัน — กันหน้าหน่วงตอนสินค้ามีหลักพันรายการ */
const VISIBLE_LIMIT = 60;

/** แท็บหมวดใหญ่หน้าตาแบบการ์ด — เขียนทับคลาสพื้นฐานของ TabsTrigger ที่ตั้งไว้เป็นปุ่มเตี้ยแถวเดียว */
const CARD_TAB =
  "h-auto flex-col items-center gap-2 rounded-xl border border-border bg-card p-4 " +
  "text-foreground transition-colors hover:bg-accent/40 " +
  "data-active:border-primary data-active:bg-primary/5 data-active:text-foreground data-active:shadow-none " +
  "dark:data-active:border-primary dark:data-active:bg-primary/10";

/** ลำดับหมวดที่ร้านอยากให้เรียง (เรียงตามการใช้งานจริง ไม่ใช่ตามตัวอักษร)
 *  หมวดที่ไม่อยู่ในลิสต์นี้ต่อท้ายเรียงตามตัวอักษรไทย และ "อื่นๆ" อยู่ท้ายสุดเสมอ */
const CATEGORY_ORDER = [
  "อาหารมื้อหลัก",
  "เบเกอรี่",
  "อาหารทานเล่น",
  "เครื่องดื่มเย็น",
  "เครื่องดื่มปั่น",
  "เครื่องดื่มร้อน",
  "เมนูคริสต์มาส",
];

/** ชื่อสินค้าตามภาษาที่ผู้ใช้เลือก — ยังไม่ได้ตั้งชื่ออังกฤษก็ใช้ชื่อไทยไปก่อน */
function productName(p: ShopProduct, locale: string) {
  return locale === "en" && p.nameEn ? p.nameEn : p.name;
}

function CategoryChips({
  categories,
  active,
  onChange,
  t,
}: {
  categories: string[];
  active: string | null;
  onChange: (value: string | null) => void;
  t: Dictionary;
}) {
  const chip = (isActive: boolean) =>
    cn(
      "shrink-0 rounded-full border px-3.5 py-1.5 text-sm transition-colors",
      isActive
        ? "border-primary bg-primary text-primary-foreground"
        : "border-border bg-background text-muted-foreground hover:bg-accent/60 hover:text-foreground"
    );

  return (
    <div className="-mx-1 mb-4 flex gap-2 overflow-x-auto px-1 pb-1">
      <button type="button" className={chip(active === null)} onClick={() => onChange(null)}>
        {t.shop.allCategories}
      </button>
      {categories.map((c) => (
        <button key={c} type="button" className={chip(active === c)} onClick={() => onChange(c)}>
          {c === UNCATEGORIZED ? t.shop.otherCategory : c}
        </button>
      ))}
    </div>
  );
}

/** เมนูหนึ่งหมวดใหญ่ (คาเฟ่คน หรือ คาเฟ่สัตว์) — เลือกหมวดย่อยด้านบน แล้วโชว์เฉพาะของในหมวดนั้น
 *  เก็บหมวดที่เลือกไว้แยกกันของใครของมัน สลับแท็บไปมาแล้วไม่รีเซ็ตของอีกฝั่ง */
function MenuSection({
  products,
  qty,
  showStock,
  onStep,
  t,
  locale,
}: {
  products: ShopProduct[];
  qty: Record<string, number>;
  showStock: boolean;
  onStep: (product: ShopProduct, delta: number) => void;
  t: Dictionary;
  locale: string;
}) {
  const [active, setActive] = useState<string | null>(null);
  const [query, setQuery] = useState("");

  const categories = useMemo(() => {
    const seen = new Set<string>();
    for (const p of products) seen.add(p.category?.trim() || UNCATEGORIZED);
    const rank = (c: string) => {
      const i = CATEGORY_ORDER.indexOf(c);
      return i === -1 ? CATEGORY_ORDER.length : i;
    };
    return [...seen].sort((a, b) => {
      if (a === UNCATEGORIZED) return 1;
      if (b === UNCATEGORIZED) return -1;
      return rank(a) - rank(b) || a.localeCompare(b, "th");
    });
  }, [products]);

  const matched = useMemo(() => {
    const q = query.trim().toLowerCase();
    return products.filter((p) => {
      if (active !== null && (p.category?.trim() || UNCATEGORIZED) !== active) return false;
      if (!q) return true;
      return p.name.toLowerCase().includes(q) || (p.nameEn ?? "").toLowerCase().includes(q);
    });
  }, [products, active, query]);

  // ร้านมีสินค้าหลักพันรายการ วาดการ์ดทั้งหมดพร้อมกันจะหน่วงและเลื่อนหาไม่เจออยู่ดี
  // จึงตัดให้เหลือชุดแรกแล้วบอกยอดจริงไว้ ให้พนักงานค้นหา/เลือกหมวดแทนการไล่ดู
  const shown = matched.slice(0, VISIBLE_LIMIT);

  return (
    <>
      <div className="relative mb-3">
        <Search className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={t.shop.searchPlaceholder}
          className="pl-9"
        />
      </div>

      {/* มีหมวดเดียวก็ไม่ต้องโชว์แถบให้เลือก ไม่มีอะไรให้กรอง */}
      {categories.length > 1 && (
        <CategoryChips categories={categories} active={active} onChange={setActive} t={t} />
      )}
      <ProductGrid
        products={shown}
        qty={qty}
        showStock={showStock}
        onStep={onStep}
        t={t}
        locale={locale}
      />
      {matched.length > shown.length && (
        <p className="mt-4 text-center text-sm text-muted-foreground">
          {t.shop.showingCount(shown.length, matched.length)}
        </p>
      )}
    </>
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
  const { t, locale } = useI18n();
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

  /** เอาออกจากรายการที่เลือกทั้งตัว — เร็วกว่ากดลบทีละชิ้นตอนสั่งไว้หลายชิ้น */
  function removeLine(id: string) {
    setQty((prev) => ({ ...prev, [id]: 0 }));
  }

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
        {/* เลือกหมวดใหญ่เป็นการ์ด — พนักงานกดบ่อยที่สุดและกดบนแท็บเล็ต ปุ่มเล็กๆ กดพลาดง่าย
            การ์ดใหญ่พร้อมรูปแยกคน/สัตว์ได้ในแวบเดียวโดยไม่ต้องอ่าน */}
        <TabsList className="mb-4 grid w-full grid-cols-2 gap-3 bg-transparent p-0 group-data-horizontal/tabs:h-auto">
          <TabsTrigger
            value="human"
            className={CARD_TAB}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/images/icons/cafe-human.png" alt="" className="h-14 w-14" />
            <span className="sr-only">{t.shop.tabCafe}</span>
            <span className="text-xs text-muted-foreground">
              {t.shop.itemCount(humanProducts.length)}
            </span>
          </TabsTrigger>
          <TabsTrigger
            value="pet"
            className={CARD_TAB}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/images/icons/cafe-pet.png" alt="" className="h-14 w-14" />
            <span className="sr-only">{t.shop.tabShop}</span>
            <span className="text-xs text-muted-foreground">
              {t.shop.itemCount(petProducts.length)}
            </span>
          </TabsTrigger>
        </TabsList>
        <TabsContent value="human" className="mt-4">
          <MenuSection
            products={humanProducts}
            qty={qty}
            showStock={false}
            onStep={step}
            t={t}
            locale={locale}
          />
        </TabsContent>
        <TabsContent value="pet" className="mt-4">
          <MenuSection
            products={petProducts}
            qty={qty}
            showStock
            onStep={step}
            t={t}
            locale={locale}
          />
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
                  <div key={l.product.id} className="flex items-center gap-2">
                    <span className="min-w-0 flex-1 truncate">{productName(l.product, locale)}</span>

                    <div className="flex shrink-0 items-center gap-1">
                      <Button
                        size="icon-sm"
                        variant="outline"
                        className="rounded-full"
                        aria-label={t.shop.decrease}
                        onClick={() => step(l.product, -1)}
                      >
                        <Minus />
                      </Button>
                      <span className="w-6 text-center tabular-nums">{l.quantity}</span>
                      <Button
                        size="icon-sm"
                        variant="outline"
                        className="rounded-full"
                        aria-label={t.shop.increase}
                        disabled={stockTracked.has(l.product.id) && l.quantity >= l.product.stockQty}
                        onClick={() => step(l.product, 1)}
                      >
                        <Plus />
                      </Button>
                    </div>

                    <span className="hidden w-12 shrink-0 text-xs text-muted-foreground sm:block">
                      {l.product.unit}
                    </span>
                    <span className="w-16 shrink-0 text-right tabular-nums text-muted-foreground">
                      {formatBaht(l.product.price * l.quantity)}
                    </span>
                    <Button
                      size="icon-sm"
                      variant="ghost"
                      className="shrink-0 rounded-full text-muted-foreground hover:text-destructive"
                      aria-label={t.shop.removeItem}
                      onClick={() => removeLine(l.product.id)}
                    >
                      <X />
                    </Button>
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
            <DialogTitle>{t.shop.billTitle}</DialogTitle>
          </DialogHeader>

          <div className="max-h-64 space-y-1.5 overflow-y-auto text-sm">
            {selectedLines.map((l) => (
              <div key={l.product.id} className="flex items-baseline justify-between gap-3">
                <span className="min-w-0 truncate">
                  {productName(l.product, locale)}
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
            <Button variant="outline" disabled={isPending} onClick={() => openBill("PROMPTPAY")}>
              {isPending && <Loader2 className="animate-spin" />}
              {t.shop.payPromptpay}
            </Button>
            <Button disabled={isPending} onClick={() => openBill("CASH")}>
              {isPending && <Loader2 className="animate-spin" />}
              {t.shop.payCash}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
