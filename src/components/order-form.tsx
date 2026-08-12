"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  Loader2,
  Search,
  UserCheck,
  Bath,
  Scissors,
  BedDouble,
  ShoppingBag,
  Minus,
  Plus,
  X,
  ClipboardCheck,
} from "lucide-react";
import { searchCustomers } from "@/app/actions/customers";
import { createOrder, updateOrder } from "@/app/actions/orders";
import { formatBaht } from "@/lib/format";
import { serviceCategoryLabel, roomSizeLabel, speciesEmoji } from "@/lib/labels";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

type Service = { id: string; name: string; category: string; price: number };
type Room = {
  id: string;
  name: string;
  size: "SMALL" | "MEDIUM" | "LARGE" | "XLARGE";
  pricePerNight: number;
  hasAir: boolean;
  hasFan: boolean;
  equipment: string | null;
};
type Product = {
  id: string;
  name: string;
  category: string | null;
  price: number;
  unit: string;
  stockQty: number;
};
type Pet = { id: string; name: string; species: "DOG" | "CAT" };
type CustomerWithPets = {
  id: string;
  name: string;
  phone: string;
  pets: Pet[];
};

type OrderInitial = {
  petId?: string | null;
  serviceIds?: string[];
  roomId?: string | null;
  nights?: number;
  productQty?: Record<string, number>;
  note?: string | null;
};

export function OrderForm({
  services,
  rooms,
  products,
  preselected,
  mode = "create",
  orderId,
  initial,
  appointmentDate,
  appointmentTime,
}: {
  services: Service[];
  rooms: Room[];
  products: Product[];
  preselected: CustomerWithPets | null;
  mode?: "create" | "edit";
  orderId?: string;
  initial?: OrderInitial;
  appointmentDate?: string;
  appointmentTime?: string;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const isEdit = mode === "edit";

  const [customer, setCustomer] = useState<CustomerWithPets | null>(preselected);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<CustomerWithPets[]>([]);
  const [searching, setSearching] = useState(false);

  const [petId, setPetId] = useState<string>(
    initial?.petId ?? preselected?.pets[0]?.id ?? ""
  );
  const [serviceIds, setServiceIds] = useState<Set<string>>(
    new Set(initial?.serviceIds ?? [])
  );
  const [roomId, setRoomId] = useState<string>(initial?.roomId ?? "");
  const [nights, setNights] = useState(initial?.nights && initial.nights > 0 ? initial.nights : 1);
  const [productQty, setProductQty] = useState<Record<string, number>>(
    initial?.productQty ?? {}
  );
  const [note, setNote] = useState(initial?.note ?? "");

  const selectedRoom = rooms.find((r) => r.id === roomId) ?? null;

  const total = useMemo(() => {
    let sum = 0;
    for (const s of services) if (serviceIds.has(s.id)) sum += s.price;
    if (selectedRoom && nights > 0) sum += selectedRoom.pricePerNight * nights;
    for (const p of products) sum += (productQty[p.id] ?? 0) * p.price;
    return sum;
  }, [services, serviceIds, selectedRoom, nights, products, productQty]);

  function doSearch() {
    setSearching(true);
    startTransition(async () => {
      const res = await searchCustomers(query);
      setResults(res as CustomerWithPets[]);
      setSearching(false);
    });
  }

  function pickCustomer(c: CustomerWithPets) {
    setCustomer(c);
    setPetId(c.pets[0]?.id ?? "");
    setResults([]);
    setQuery("");
  }

  function toggleService(id: string) {
    const svc = services.find((s) => s.id === id);
    setServiceIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        // เลือกได้หมวดละ 1 อัน — ยกเลิกรายการอื่นในหมวดเดียวกันก่อน
        if (svc) {
          for (const other of services) {
            if (other.category === svc.category && next.has(other.id)) {
              next.delete(other.id);
            }
          }
        }
        next.add(id);
      }
      return next;
    });
  }

  function setQty(id: string, delta: number) {
    setProductQty((prev) => {
      const current = prev[id] ?? 0;
      const next = Math.max(0, current + delta);
      const copy = { ...prev };
      if (next === 0) delete copy[id];
      else copy[id] = next;
      return copy;
    });
  }

  function submit() {
    if (!customer) {
      toast.error("กรุณาเลือกลูกค้า");
      return;
    }
    const productLines = Object.entries(productQty)
      .filter(([, q]) => q > 0)
      .map(([productId, quantity]) => ({ productId, quantity }));

    const payload = {
      customerId: customer.id,
      petId: petId || null,
      roomId: roomId || null,
      nights: roomId ? nights : 0,
      serviceIds: [...serviceIds],
      productLines,
      note,
      appointmentDate,
      appointmentTime,
    };

    startTransition(async () => {
      const res =
        isEdit && orderId ? await updateOrder(orderId, payload) : await createOrder(payload);
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      toast.success(res.message ?? "สำเร็จ");
      router.push(`/orders/${res.id ?? orderId}`);
    });
  }

  const groupedServices = useMemo(() => {
    const map: Record<string, Service[]> = {};
    for (const s of services) (map[s.category] ??= []).push(s);
    return map;
  }, [services]);

  const serviceIcon = (cat: string) =>
    cat === "GROOMING" ? Scissors : cat === "BATH" ? Bath : ClipboardCheck;

  return (
    <div className="grid gap-6 lg:grid-cols-3">
      <div className="space-y-6 lg:col-span-2">
        {/* 1. ลูกค้า */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">1. เลือกลูกค้า</CardTitle>
          </CardHeader>
          <CardContent>
            {customer ? (
              <div className="flex items-center justify-between rounded-lg border bg-accent/40 p-3">
                <div>
                  <div className="flex items-center gap-2 font-medium">
                    <UserCheck className="h-4 w-4 text-primary" />
                    {customer.name}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {customer.phone} · {customer.pets.length} สัตว์เลี้ยง
                  </div>
                </div>
                {!isEdit && (
                  <Button variant="ghost" size="sm" onClick={() => setCustomer(null)}>
                    <X /> เปลี่ยน
                  </Button>
                )}
              </div>
            ) : (
              <div className="space-y-3">
                <div className="flex gap-2">
                  <Input
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), doSearch())}
                    placeholder="ค้นหาด้วยชื่อหรือเบอร์โทร"
                  />
                  <Button type="button" variant="secondary" onClick={doSearch} disabled={searching}>
                    {searching ? <Loader2 className="animate-spin" /> : <Search />}
                    ค้นหา
                  </Button>
                </div>
                {results.length > 0 && (
                  <div className="divide-y rounded-lg border">
                    {results.map((c) => (
                      <button
                        key={c.id}
                        type="button"
                        onClick={() => pickCustomer(c)}
                        className="flex w-full items-center justify-between px-3 py-2 text-left text-sm hover:bg-accent"
                      >
                        <span>
                          <span className="font-medium">{c.name}</span>
                          <span className="text-muted-foreground"> · {c.phone}</span>
                        </span>
                        <span className="text-xs text-muted-foreground">
                          {c.pets.map((p) => speciesEmoji[p.species]).join("")}
                        </span>
                      </button>
                    ))}
                  </div>
                )}
                <p className="text-xs text-muted-foreground">
                  ไม่พบลูกค้า?{" "}
                  <a href="/register" className="text-primary underline">
                    ลงทะเบียนใหม่
                  </a>
                </p>
              </div>
            )}

            {customer && customer.pets.length > 0 && (
              <div className="mt-4 space-y-2">
                <Label>สัตว์เลี้ยง</Label>
                <Select
                  value={petId}
                  onValueChange={(v) => setPetId(v ?? "")}
                  items={customer.pets.map((p) => ({
                    value: p.id,
                    label: `${speciesEmoji[p.species]} ${p.name}`,
                  }))}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="เลือกสัตว์เลี้ยง" />
                  </SelectTrigger>
                  <SelectContent>
                    {customer.pets.map((p) => (
                      <SelectItem key={p.id} value={p.id}>
                        {speciesEmoji[p.species]} {p.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
          </CardContent>
        </Card>

        {/* 2. บริการ */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">2. บริการ</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {Object.entries(groupedServices).map(([cat, list]) => {
              const Icon = serviceIcon(cat);
              return (
                <div key={cat}>
                  <div className="mb-2 flex items-center gap-1.5 text-sm font-medium text-muted-foreground">
                    <Icon className="h-4 w-4" />
                    {serviceCategoryLabel[cat as keyof typeof serviceCategoryLabel]}
                  </div>
                  <div className="grid gap-2 sm:grid-cols-2">
                    {list.map((s) => {
                      const active = serviceIds.has(s.id);
                      return (
                        <button
                          key={s.id}
                          type="button"
                          onClick={() => toggleService(s.id)}
                          className={cn(
                            "flex items-center justify-between rounded-lg border p-3 text-left text-sm transition-colors",
                            active
                              ? "border-primary bg-primary/10"
                              : "hover:bg-accent"
                          )}
                        >
                          <span className={cn(active && "font-medium")}>{s.name}</span>
                          <span className="text-muted-foreground">{formatBaht(s.price)}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </CardContent>
        </Card>

        {/* 3. ห้องพัก */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <BedDouble className="h-4 w-4" /> 3. ห้องพัก (ฝากเลี้ยง)
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="grid gap-3 sm:grid-cols-[1fr_auto]">
              <Select
                value={roomId}
                onValueChange={(v) => setRoomId(v ?? "")}
                items={rooms.map((r) => ({
                  value: r.id,
                  label: `${r.name} · ${roomSizeLabel[r.size]} · ${formatBaht(r.pricePerNight)}/คืน`,
                }))}
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="เลือกห้อง (ถ้ามีการฝากเลี้ยง)" />
                </SelectTrigger>
                <SelectContent>
                  {rooms.map((r) => (
                    <SelectItem key={r.id} value={r.id}>
                      {r.name} · {roomSizeLabel[r.size]} · {formatBaht(r.pricePerNight)}/คืน
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {roomId && (
                <div className="flex items-center gap-2">
                  <Label className="text-sm">จำนวนคืน</Label>
                  <Input
                    type="number"
                    min={1}
                    value={nights}
                    onChange={(e) => setNights(Math.max(1, Number(e.target.value)))}
                    className="w-20"
                  />
                </div>
              )}
            </div>
            {selectedRoom && (
              <div className="flex flex-wrap gap-2 text-xs">
                {selectedRoom.hasAir && <Badge variant="secondary">แอร์</Badge>}
                {selectedRoom.hasFan && <Badge variant="secondary">พัดลม</Badge>}
                {selectedRoom.equipment
                  ?.split(",")
                  .filter(Boolean)
                  .map((e) => (
                    <Badge key={e} variant="outline">
                      {e.trim()}
                    </Badge>
                  ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* 4. สินค้า */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <ShoppingBag className="h-4 w-4" /> 4. สินค้า / ขนม (เพิ่มเติม)
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid gap-2 sm:grid-cols-2">
              {products.map((p) => {
                const qty = productQty[p.id] ?? 0;
                return (
                  <div
                    key={p.id}
                    className={cn(
                      "flex items-center justify-between rounded-lg border p-3 text-sm",
                      qty > 0 && "border-primary bg-primary/5"
                    )}
                  >
                    <div className="min-w-0">
                      <div className="truncate font-medium">{p.name}</div>
                      <div className="text-xs text-muted-foreground">
                        {formatBaht(p.price)} · เหลือ {p.stockQty} {p.unit}
                      </div>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <Button
                        type="button"
                        size="icon"
                        variant="outline"
                        className="h-7 w-7"
                        onClick={() => setQty(p.id, -1)}
                        disabled={qty === 0}
                      >
                        <Minus className="h-3 w-3" />
                      </Button>
                      <span className="w-5 text-center">{qty}</span>
                      <Button
                        type="button"
                        size="icon"
                        variant="outline"
                        className="h-7 w-7"
                        onClick={() => setQty(p.id, 1)}
                      >
                        <Plus className="h-3 w-3" />
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* สรุป */}
      <div className="lg:col-span-1">
        <Card className="lg:sticky lg:top-20">
          <CardHeader>
            <CardTitle className="text-base">สรุปออเดอร์</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="space-y-1.5 text-sm">
              {[...serviceIds].map((id) => {
                const s = services.find((x) => x.id === id);
                if (!s) return null;
                return (
                  <div key={id} className="flex justify-between">
                    <span className="text-muted-foreground">{s.name}</span>
                    <span>{formatBaht(s.price)}</span>
                  </div>
                );
              })}
              {selectedRoom && nights > 0 && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">
                    ห้อง {selectedRoom.name} × {nights} คืน
                  </span>
                  <span>{formatBaht(selectedRoom.pricePerNight * nights)}</span>
                </div>
              )}
              {Object.entries(productQty).map(([id, qty]) => {
                const p = products.find((x) => x.id === id);
                if (!p || qty === 0) return null;
                return (
                  <div key={id} className="flex justify-between">
                    <span className="text-muted-foreground">
                      {p.name} × {qty}
                    </span>
                    <span>{formatBaht(p.price * qty)}</span>
                  </div>
                );
              })}
              {total === 0 && (
                <p className="py-4 text-center text-sm text-muted-foreground">
                  ยังไม่ได้เลือกรายการ
                </p>
              )}
            </div>

            <div className="border-t pt-3">
              <Label className="text-xs">หมายเหตุ</Label>
              <Textarea
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="หมายเหตุออเดอร์ (ถ้ามี)"
                rows={2}
                className="mt-1"
              />
            </div>

            <div className="flex items-center justify-between border-t pt-3 text-lg font-bold">
              <span>ยอดรวม</span>
              <span className="text-primary">{formatBaht(total)}</span>
            </div>

            <Button
              className="w-full"
              size="lg"
              onClick={submit}
              disabled={isPending || total === 0 || !customer}
            >
              {isPending ? <Loader2 className="animate-spin" /> : <ClipboardCheck />}
              {isEdit ? "บันทึกการแก้ไข + สร้าง QR ใหม่" : "ยืนยันออเดอร์ + สร้าง QR"}
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
