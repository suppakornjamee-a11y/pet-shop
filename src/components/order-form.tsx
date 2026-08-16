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
import { toThaiDateStr, addDaysThai, daysBetween } from "@/lib/slots";
import { speciesEmoji } from "@/lib/labels";
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
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useI18n } from "@/components/i18n-provider";

type Service = { id: string; name: string; category: string; price: number };
type Room = {
  id: string;
  categoryId: string;
  categoryName: string;
  billingUnit: "PER_NIGHT" | "PER_VISIT";
  name: string;
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
type Pet = {
  id: string;
  name: string;
  species: "DOG" | "CAT";
  vaccineComplete: boolean | null;
  lastFleaTickAt: string | null;
  fleaTickMedicine: string | null;
};
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
  checkInDate?: string;
  checkInTime?: string;
  checkOutDate?: string;
  checkOutTime?: string;
  nanny?: boolean;
  depositAmount?: number;
  vaccineComplete?: boolean;
  lastFleaTickDate?: string;
  fleaTickMedicine?: string;
  productQty?: Record<string, number>;
  note?: string | null;
};

const todayStr = () => toThaiDateStr(new Date());

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
  const { t } = useI18n();
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
  const [checkInDate, setCheckInDate] = useState(initial?.checkInDate || todayStr());
  const [checkInTime, setCheckInTime] = useState(initial?.checkInTime || "13:00");
  const [checkOutDate, setCheckOutDate] = useState(
    initial?.checkOutDate || addDaysThai(initial?.checkInDate || todayStr(), 1)
  );
  const [checkOutTime, setCheckOutTime] = useState(initial?.checkOutTime || "11:00");
  const [nanny, setNanny] = useState(initial?.nanny ?? false);
  const [depositAmount, setDepositAmount] = useState(String(initial?.depositAmount ?? 0));
  const [vaccineComplete, setVaccineComplete] = useState(initial?.vaccineComplete ?? false);
  const [lastFleaTickDate, setLastFleaTickDate] = useState(initial?.lastFleaTickDate ?? "");
  const [fleaTickMedicine, setFleaTickMedicine] = useState(initial?.fleaTickMedicine ?? "");
  const [productQty, setProductQty] = useState<Record<string, number>>(
    initial?.productQty ?? {}
  );
  const [note, setNote] = useState(initial?.note ?? "");

  const selectedRoom = rooms.find((r) => r.id === roomId) ?? null;
  const isPerVisit = selectedRoom?.billingUnit === "PER_VISIT";
  const nights =
    selectedRoom && !isPerVisit ? Math.max(1, daysBetween(checkInDate, checkOutDate)) : 0;

  const roomsByCategory = useMemo(() => {
    const map = new Map<string, { categoryName: string; rooms: Room[] }>();
    for (const r of rooms) {
      const entry = map.get(r.categoryId) ?? { categoryName: r.categoryName, rooms: [] };
      entry.rooms.push(r);
      map.set(r.categoryId, entry);
    }
    return [...map.values()];
  }, [rooms]);

  const total = useMemo(() => {
    let sum = 0;
    for (const s of services) if (serviceIds.has(s.id)) sum += s.price;
    if (selectedRoom) sum += selectedRoom.pricePerNight * (nights > 0 ? nights : 1);
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

  function prefillFromPet(pet?: Pet) {
    if (!pet) return;
    setVaccineComplete(pet.vaccineComplete ?? false);
    setLastFleaTickDate(pet.lastFleaTickAt ? toThaiDateStr(new Date(pet.lastFleaTickAt)) : "");
    setFleaTickMedicine(pet.fleaTickMedicine ?? "");
  }

  function pickCustomer(c: CustomerWithPets) {
    setCustomer(c);
    const firstPet = c.pets[0];
    setPetId(firstPet?.id ?? "");
    prefillFromPet(firstPet);
    setResults([]);
    setQuery("");
  }

  function onPetChange(id: string) {
    setPetId(id);
    prefillFromPet(customer?.pets.find((p) => p.id === id));
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

  function onRoomChange(id: string) {
    setRoomId(id);
    const room = rooms.find((r) => r.id === id);
    if (room?.billingUnit === "PER_VISIT") {
      setCheckOutDate(checkInDate);
    } else if (checkOutDate <= checkInDate) {
      setCheckOutDate(addDaysThai(checkInDate, 1));
    }
  }

  function onCheckInDateChange(v: string) {
    setCheckInDate(v);
    if (isPerVisit) setCheckOutDate(v);
    else if (checkOutDate <= v) setCheckOutDate(addDaysThai(v, 1));
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
      toast.error(t.orders.form.selectCustomerError);
      return;
    }
    const productLines = Object.entries(productQty)
      .filter(([, q]) => q > 0)
      .map(([productId, quantity]) => ({ productId, quantity }));

    const payload = {
      customerId: customer.id,
      petId: petId || null,
      roomId: roomId || null,
      checkInDate: roomId ? checkInDate : undefined,
      checkInTime: roomId ? checkInTime : undefined,
      checkOutDate: roomId ? checkOutDate : undefined,
      checkOutTime: roomId ? checkOutTime : undefined,
      nanny: roomId ? nanny : false,
      depositAmount: roomId ? Number(depositAmount || 0) : 0,
      vaccineComplete: roomId ? vaccineComplete : false,
      lastFleaTickDate: roomId ? lastFleaTickDate : undefined,
      fleaTickMedicine: roomId ? fleaTickMedicine : undefined,
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
      toast.success(res.message ?? t.orders.form.genericSuccess);
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
            <CardTitle className="text-base">{t.orders.form.step1Title}</CardTitle>
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
                    {customer.phone} · {t.orders.form.petsCount(customer.pets.length)}
                  </div>
                </div>
                {!isEdit && (
                  <Button variant="ghost" size="sm" onClick={() => setCustomer(null)}>
                    <X /> {t.orders.form.changeCustomer}
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
                    placeholder={t.orders.form.searchPlaceholder}
                  />
                  <Button type="button" variant="secondary" onClick={doSearch} disabled={searching}>
                    {searching ? <Loader2 className="animate-spin" /> : <Search />}
                    {t.common.search}
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
              </div>
            )}

            {customer && customer.pets.length > 0 && (
              <div className="mt-4 space-y-2">
                <Label>{t.orders.form.petLabel}</Label>
                <Select
                  value={petId}
                  onValueChange={(v) => onPetChange(v ?? "")}
                  items={customer.pets.map((p) => ({
                    value: p.id,
                    label: `${speciesEmoji[p.species]} ${p.name}`,
                  }))}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder={t.orders.form.selectPet} />
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

        {/* 2. ห้องพัก / คอก / พื้นที่ */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <BedDouble className="h-4 w-4" /> {t.orders.form.step2Title}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <Select
              value={roomId}
              onValueChange={(v) => onRoomChange(v ?? "")}
              items={rooms.map((r) => ({
                value: r.id,
                label: `${r.categoryName} · ${r.name} · ${formatBaht(r.pricePerNight)}/${
                  r.billingUnit === "PER_NIGHT" ? t.orders.form.perNightUnit : t.orders.form.perVisitUnit
                }`,
              }))}
            >
              <SelectTrigger className="w-full">
                <SelectValue placeholder={t.orders.form.selectRoomPlaceholder} />
              </SelectTrigger>
              <SelectContent>
                {roomsByCategory.map(({ categoryName, rooms: roomsInCat }) => (
                  <SelectGroup key={categoryName}>
                    <SelectLabel>{categoryName}</SelectLabel>
                    {roomsInCat.map((r) => (
                      <SelectItem key={r.id} value={r.id}>
                        {r.name} · {formatBaht(r.pricePerNight)}/
                        {r.billingUnit === "PER_NIGHT" ? t.orders.form.perNightUnit : t.orders.form.perVisitUnit}
                      </SelectItem>
                    ))}
                  </SelectGroup>
                ))}
              </SelectContent>
            </Select>

            {selectedRoom && (
              <>
                <div className="flex flex-wrap gap-2 text-xs">
                  <Badge variant="secondary">{t.labels.billingUnit[selectedRoom.billingUnit]}</Badge>
                  {selectedRoom.hasAir && <Badge variant="secondary">{t.settings.rooms.hasAir}</Badge>}
                  {selectedRoom.hasFan && <Badge variant="secondary">{t.settings.rooms.hasFan}</Badge>}
                  {selectedRoom.equipment
                    ?.split(",")
                    .filter(Boolean)
                    .map((e) => (
                      <Badge key={e} variant="outline">
                        {e.trim()}
                      </Badge>
                    ))}
                </div>

                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="space-y-1.5">
                    <Label className="text-xs">{t.orders.form.checkInLabel}</Label>
                    <div className="grid grid-cols-[1fr_auto] gap-2">
                      <Input
                        type="date"
                        className="min-w-0"
                        value={checkInDate}
                        onChange={(e) => onCheckInDateChange(e.target.value)}
                      />
                      <Input
                        type="time"
                        value={checkInTime}
                        onChange={(e) => setCheckInTime(e.target.value)}
                        className="w-24"
                      />
                    </div>
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs">{t.orders.form.checkOutLabel}</Label>
                    <div className="grid grid-cols-[1fr_auto] gap-2">
                      <Input
                        type="date"
                        className="min-w-0"
                        value={checkOutDate}
                        min={checkInDate}
                        disabled={isPerVisit}
                        onChange={(e) => setCheckOutDate(e.target.value)}
                      />
                      <Input
                        type="time"
                        value={checkOutTime}
                        onChange={(e) => setCheckOutTime(e.target.value)}
                        className="w-24"
                      />
                    </div>
                  </div>
                </div>
                {!isPerVisit && (
                  <p className="text-xs text-muted-foreground">{t.orders.form.nightsCount(nights)}</p>
                )}

                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={nanny}
                    onChange={(e) => setNanny(e.target.checked)}
                    className="h-4 w-4 accent-primary"
                  />
                  {t.orders.form.nannyCheckbox}
                </label>

                <div className="grid gap-3 sm:grid-cols-[1fr_auto]">
                  <div className="space-y-1.5">
                    <Label className="text-xs">{t.orders.form.depositLabel}</Label>
                    <Input
                      type="number"
                      min={0}
                      value={depositAmount}
                      onChange={(e) => setDepositAmount(e.target.value)}
                    />
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    className="self-end"
                    onClick={() => setDepositAmount(String(Math.round(total / 2 / 10) * 10))}
                  >
                    {t.orders.form.deposit50}
                  </Button>
                </div>
              </>
            )}
          </CardContent>
        </Card>

        {/* 3. บริการ */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">{t.orders.form.step3Title}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {Object.entries(groupedServices).map(([cat, list]) => {
              const Icon = serviceIcon(cat);
              return (
                <div key={cat}>
                  <div className="mb-2 flex items-center gap-1.5 text-sm font-medium text-muted-foreground">
                    <Icon className="h-4 w-4" />
                    {t.labels.serviceCategory[cat as keyof typeof t.labels.serviceCategory]}
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

        {/* 4. สินค้า */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <ShoppingBag className="h-4 w-4" /> {t.orders.form.step4Title}
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
                        {formatBaht(p.price)} · {t.orders.form.remainingStock(p.stockQty, p.unit)}
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
            <CardTitle className="text-base">{t.orders.form.orderSummary}</CardTitle>
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
              {selectedRoom && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">
                    {selectedRoom.categoryName} {selectedRoom.name}
                    {nights > 0 ? ` × ${t.orders.form.nightsCount(nights)}` : ` × 1 ${t.orders.form.perVisitUnit}`}
                  </span>
                  <span>{formatBaht(selectedRoom.pricePerNight * (nights > 0 ? nights : 1))}</span>
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
                  {t.orders.form.noItemsSelected}
                </p>
              )}
            </div>

            <div className="border-t pt-3">
              <Label className="text-xs">{t.orders.form.noteLabel}</Label>
              <Textarea
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder={t.orders.form.notePlaceholder}
                rows={2}
                className="mt-1"
              />
            </div>

            <div className="flex items-center justify-between border-t pt-3 text-lg font-bold">
              <span>{t.orders.form.grandTotal}</span>
              <span className="text-primary">{formatBaht(total)}</span>
            </div>
            {roomId && Number(depositAmount || 0) > 0 && (
              <div className="flex items-center justify-between text-xs text-muted-foreground">
                <span>{t.orders.form.depositNowRemaining}</span>
                <span>
                  {formatBaht(Number(depositAmount || 0))} / {formatBaht(total - Number(depositAmount || 0))}
                </span>
              </div>
            )}

            <Button
              className="w-full"
              size="lg"
              onClick={submit}
              disabled={isPending || total === 0 || !customer}
            >
              {isPending ? <Loader2 className="animate-spin" /> : <ClipboardCheck />}
              {isEdit ? t.orders.form.submitEdit : t.orders.form.submitCreate}
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
