"use client";

import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Loader2, ClipboardCheck } from "lucide-react";
import {
  liffBootstrap,
  getBookableServices,
  getBookableRooms,
  checkRoomAvailability,
  getOpenSlots,
  liffCreateOrder,
} from "@/app/actions/liff";
import { formatBaht } from "@/lib/format";
import { toThaiDateStr, addDaysThai, daysBetween } from "@/lib/slots";
import { cn } from "@/lib/utils";
import { SpeciesIcon } from "@/components/species-icon";
import { useLiff, LiffGate, handleLiffAuthExpiry } from "@/components/liff-provider";
import { useI18n } from "@/components/i18n-provider";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

type Pet = { id: string; name: string; species: "DOG" | "CAT" };
type Service = {
  id: string;
  name: string;
  category: string;
  group: string | null;
  speciesScope: "DOG" | "CAT" | null;
  defaultOn: boolean;
  price: number;
};
type Room = {
  id: string;
  categoryId: string;
  name: string;
  pricePerNight: number;
  hasAir: boolean;
  hasFan: boolean;
  equipment: string | null;
  category: { id: string; name: string; billingUnit: "PER_NIGHT" | "PER_VISIT" };
};
type Kind = "BATH" | "OTHER" | "BOARDING";

const todayStr = () => toThaiDateStr(new Date());
const NANNY_REGULAR_RATE = 300;
const NANNY_VIP_RATE = 400;
const CCTV_ROOM_RATE = 100;
const BATH_DEPOSIT_AMOUNT = 300;

function exclusiveKey(s: Service): string | null {
  if (s.defaultOn) return null;
  if (s.category === "BATH" && !s.group) return "BATH";
  if (s.category === "GROOMING") return "GROOMING";
  return null;
}

// ตัวเลือกวัน/เวลาแบบ <select> ล้วนๆ แทน <input type="date"/"time"> ของเบราว์เซอร์ —
// input วันที่/เวลาแบบ native เรนเดอร์ไม่นิ่งในหลาย webview (ทับกันเอง/ล้นขอบจอ/แตะเลือกไม่ติด
// โดยเฉพาะ webview ในแอป LINE) เปลี่ยนมาใช้ select ธรรมดาซึ่งขนาดคงที่ ควบคุมได้ ไม่พังข้ามอุปกรณ์
const SELECT_CLASS = "h-9 w-full min-w-0 rounded-md border bg-transparent px-1.5 text-center text-sm";

function daysInMonth(year: number, month: number): number {
  return new Date(year, month, 0).getDate();
}
function parseDateStr(v: string): { y: number; m: number; d: number } {
  const [y, m, d] = v.split("-").map(Number);
  return { y, m, d };
}
function formatDateStr(y: number, m: number, d: number): string {
  return `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
}
/** เพิ่ม 1 ชั่วโมงให้เวลา HH:mm (วนกลับ 00:00 ถ้าเลย 23:59) */
function addOneHour(timeStr: string): string {
  const [h, m] = timeStr.split(":").map(Number);
  const total = (h * 60 + m + 60) % (24 * 60);
  return `${String(Math.floor(total / 60)).padStart(2, "0")}:${String(total % 60).padStart(2, "0")}`;
}

function DateSelect({
  value,
  onChange,
  min,
  disabled,
}: {
  value: string;
  onChange: (v: string) => void;
  min?: string;
  disabled?: boolean;
}) {
  const { y, m, d } = parseDateStr(value);
  const baseYear = min ? parseDateStr(min).y : y;
  const yearOptions = [baseYear, baseYear + 1];
  const maxDay = daysInMonth(y, m);

  function update(newY: number, newM: number, newD: number) {
    const clampedDay = Math.min(newD, daysInMonth(newY, newM));
    let next = formatDateStr(newY, newM, clampedDay);
    if (min && next < min) next = min;
    onChange(next);
  }

  return (
    <div className="grid grid-cols-3 gap-2">
      <select
        value={d}
        disabled={disabled}
        onChange={(e) => update(y, m, Number(e.target.value))}
        className={cn(SELECT_CLASS, "disabled:opacity-50")}
      >
        {Array.from({ length: maxDay }, (_, i) => i + 1).map((day) => (
          <option key={day} value={day}>
            {day}
          </option>
        ))}
      </select>
      <select
        value={m}
        disabled={disabled}
        onChange={(e) => update(y, Number(e.target.value), d)}
        className={cn(SELECT_CLASS, "disabled:opacity-50")}
      >
        {Array.from({ length: 12 }, (_, i) => i + 1).map((month) => (
          <option key={month} value={month}>
            {month}
          </option>
        ))}
      </select>
      <select
        value={y}
        disabled={disabled}
        onChange={(e) => update(Number(e.target.value), m, d)}
        className={cn(SELECT_CLASS, "disabled:opacity-50")}
      >
        {yearOptions.map((year) => (
          <option key={year} value={year}>
            {year + 543}
          </option>
        ))}
      </select>
    </div>
  );
}

function TimeSelect({
  value,
  onChange,
  minHour = 0,
  maxHour = 23,
}: {
  value: string;
  onChange: (v: string) => void;
  minHour?: number;
  maxHour?: number;
}) {
  const [hh, mm] = value.split(":").map(Number);
  function update(newHH: number, newMM: number) {
    onChange(`${String(newHH).padStart(2, "0")}:${String(newMM).padStart(2, "0")}`);
  }
  return (
    <div className="grid grid-cols-2 gap-2">
      <select value={hh} onChange={(e) => update(Number(e.target.value), mm)} className={SELECT_CLASS}>
        {Array.from({ length: maxHour - minHour + 1 }, (_, i) => minHour + i).map((h) => (
          <option key={h} value={h}>
            {String(h).padStart(2, "0")}
          </option>
        ))}
      </select>
      <select value={mm} onChange={(e) => update(hh, Number(e.target.value))} className={SELECT_CLASS}>
        {[0, 15, 30, 45].map((min) => (
          <option key={min} value={min}>
            {String(min).padStart(2, "0")}
          </option>
        ))}
      </select>
    </div>
  );
}

type SlotOption = { time: string; available: boolean };

/** เวลาสิ้นสุดของช่วง 30 นาที เช่น "10:00" -> "10:30" — ใช้แสดงผลเป็นช่วงเท่านั้น
 * ระบบยังเก็บแค่เวลาเริ่ม (time) เป็นค่านัดหมายจริงเหมือนเดิม ไม่ได้เพิ่มฟิลด์ใหม่ */
function slotEndLabel(time: string): string {
  const [h, m] = time.split(":").map(Number);
  const total = h * 60 + m + 30;
  return `${String(Math.floor(total / 60) % 24).padStart(2, "0")}:${String(total % 60).padStart(2, "0")}`;
}

const WHEEL_ITEM_HEIGHT = 40;
const WHEEL_VISIBLE_ITEMS = 5;

/** ตัวเลือกช่วงเวลาแบบเลื่อนวน (wheel) — เลื่อนแล้วช่วงที่อยู่กลางกรอบไฮไลต์คือช่วงที่เลือก
 * ช่วงที่เต็มแล้วเลื่อนผ่านได้แต่กดเลือก/ปล่อยเลื่อนค้างไว้ไม่ได้ จะสะกิดไปช่วงว่างที่ใกล้ที่สุดให้แทน */
function TimeWheelPicker({
  slots,
  value,
  onChange,
}: {
  slots: SlotOption[];
  value: string;
  onChange: (time: string) => void;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const scrollTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const selectedIndex = value
    ? Math.max(0, slots.findIndex((s) => s.time === value))
    : Math.max(0, slots.findIndex((s) => s.available));

  // เลื่อนไปตำแหน่งที่ควรเลือกทุกครั้งที่รายการช่วงเวลาเปลี่ยน (เช่น เปลี่ยนวันที่) และ sync
  // ค่าเริ่มต้นกลับขึ้นไปให้ฟอร์มหลักรู้ด้วยถ้ายังไม่เคยเลือกอะไรมาก่อน
  useEffect(() => {
    const el = containerRef.current;
    if (!el || slots.length === 0) return;
    el.scrollTop = selectedIndex * WHEEL_ITEM_HEIGHT;
    if (!value && slots[selectedIndex]?.available) onChange(slots[selectedIndex].time);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [slots]);

  function selectIndex(idx: number) {
    const clamped = Math.max(0, Math.min(slots.length - 1, idx));
    const slot = slots[clamped];
    if (slot?.available) onChange(slot.time);
    containerRef.current?.scrollTo({ top: clamped * WHEEL_ITEM_HEIGHT, behavior: "smooth" });
  }

  function handleScrollSettled() {
    const el = containerRef.current;
    if (!el) return;
    const idx = Math.round(el.scrollTop / WHEEL_ITEM_HEIGHT);
    const clamped = Math.max(0, Math.min(slots.length - 1, idx));
    if (slots[clamped]?.available) {
      selectIndex(clamped);
      return;
    }
    let nearest = -1;
    let bestDist = Infinity;
    slots.forEach((s, i) => {
      if (!s.available) return;
      const dist = Math.abs(i - clamped);
      if (dist < bestDist) {
        bestDist = dist;
        nearest = i;
      }
    });
    selectIndex(nearest >= 0 ? nearest : clamped);
  }

  function onScroll() {
    if (scrollTimeoutRef.current) clearTimeout(scrollTimeoutRef.current);
    scrollTimeoutRef.current = setTimeout(handleScrollSettled, 120);
  }

  const padding = ((WHEEL_VISIBLE_ITEMS - 1) / 2) * WHEEL_ITEM_HEIGHT;

  return (
    <div className="relative" style={{ height: WHEEL_ITEM_HEIGHT * WHEEL_VISIBLE_ITEMS }}>
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-1/2 -translate-y-1/2 rounded-md border-y-2 border-primary/50 bg-primary/5"
        style={{ height: WHEEL_ITEM_HEIGHT }}
      />
      <div
        ref={containerRef}
        onScroll={onScroll}
        className="h-full snap-y snap-mandatory overflow-y-auto [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      >
        <div style={{ height: padding }} />
        {slots.map((s, i) => {
          const isSelected = i === selectedIndex;
          return (
            <div
              key={s.time}
              onClick={() => selectIndex(i)}
              style={{ height: WHEEL_ITEM_HEIGHT }}
              className={cn(
                "flex snap-center items-center justify-center text-sm transition-all",
                !s.available && "text-muted-foreground/40 line-through",
                s.available && isSelected && "text-base font-semibold text-foreground",
                s.available && !isSelected && "cursor-pointer text-muted-foreground"
              )}
            >
              {s.time} - {slotEndLabel(s.time)}
            </div>
          );
        })}
        <div style={{ height: padding }} />
      </div>
    </div>
  );
}

function BookingBody() {
  const { t } = useI18n();
  const router = useRouter();
  const { idToken } = useLiff();
  const [isPending, startTransition] = useTransition();

  const [loadingCustomer, setLoadingCustomer] = useState(true);
  const [pets, setPets] = useState<Pet[]>([]);
  const [petId, setPetId] = useState("");

  const [kind, setKind] = useState<Kind>("BATH");
  const [services, setServices] = useState<Service[]>([]);
  const [serviceIds, setServiceIds] = useState<Set<string>>(new Set());

  const [date, setDate] = useState(todayStr());
  const [slots, setSlots] = useState<{ time: string; available: boolean }[]>([]);
  const [time, setTime] = useState("");
  const [loadingSlots, setLoadingSlots] = useState(false);

  const [rooms, setRooms] = useState<Room[]>([]);
  const [roomId, setRoomId] = useState("");
  const [checkInDate, setCheckInDate] = useState(todayStr());
  const [checkInTime, setCheckInTime] = useState("13:00");
  const [checkOutDate, setCheckOutDate] = useState(addDaysThai(todayStr(), 1));
  const [checkOutTime, setCheckOutTime] = useState("11:00");
  const [roomAvailable, setRoomAvailable] = useState<boolean | null>(null);
  const [checkingRoom, setCheckingRoom] = useState(false);
  const [nannyType, setNannyType] = useState<"NONE" | "REGULAR" | "VIP">("NONE");
  const [cctvRequested, setCctvRequested] = useState(false);

  const [note, setNote] = useState("");

  // โหลดข้อมูลลูกค้า+สัตว์เลี้ยงสดใหม่ทุกครั้งที่เข้าหน้านี้ (ไม่พึ่ง state ข้ามหน้า)
  useEffect(() => {
    if (!idToken) return;
    let active = true;
    (async () => {
      const res = await liffBootstrap(idToken);
      if (!active) return;
      if (!res.ok) {
        handleLiffAuthExpiry(res);
        router.replace("/liff");
        return;
      }
      if (!res.linked) {
        router.replace("/liff");
        return;
      }
      setPets(res.customer.pets);
      setPetId(res.customer.pets[0]?.id ?? "");
      setLoadingCustomer(false);
    })();
    return () => {
      active = false;
    };
  }, [idToken, router]);

  useEffect(() => {
    getBookableRooms().then(setRooms);
  }, []);

  useEffect(() => {
    const timeoutId = setTimeout(() => {
      getBookableServices(kind).then((list) => {
        setServices(list);
        setServiceIds(new Set());
      });
    }, 0);
    return () => clearTimeout(timeoutId);
  }, [kind]);

  const selectedPet = pets.find((p) => p.id === petId);
  const speciesFilteredServices = useMemo(
    () => services.filter((s) => !s.speciesScope || !selectedPet || s.speciesScope === selectedPet.species),
    [services, selectedPet]
  );
  const defaultOnServices = useMemo(
    () => speciesFilteredServices.filter((s) => s.defaultOn).sort((a, b) => a.price - b.price),
    [speciesFilteredServices]
  );
  const pickableServices = useMemo(
    () => speciesFilteredServices.filter((s) => !s.defaultOn).sort((a, b) => a.price - b.price),
    [speciesFilteredServices]
  );

  // จองอาบน้ำ: ติ๊กรายการที่รวมอยู่แล้ว (ไถเท้า/ไถท้อง ฯลฯ) ให้อัตโนมัติตามชนิดสัตว์ — ถอนออกเองได้
  // ปรับ state ระหว่าง render โดยตรง (ไม่ใช้ useEffect) เพื่อเลี่ยง cascading render ตาม React docs
  // "You Might Not Need an Effect" — เทียบค่าล่าสุดที่เคย apply ไปแล้วก่อนค่อยตัดสินใจ setState
  const defaultOnKey = kind === "BATH" ? defaultOnServices.map((s) => s.id).join(",") : "";
  const [appliedDefaultOnKey, setAppliedDefaultOnKey] = useState("");
  if (defaultOnKey && defaultOnKey !== appliedDefaultOnKey) {
    setAppliedDefaultOnKey(defaultOnKey);
    setServiceIds((prev) => {
      const next = new Set(prev);
      for (const id of defaultOnKey.split(",")) next.add(id);
      return next;
    });
  }

  function toggleService(id: string) {
    const svc = services.find((s) => s.id === id);
    setServiceIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        const key = svc ? exclusiveKey(svc) : null;
        if (key) {
          for (const other of services) {
            if (other.id !== id && exclusiveKey(other) === key) next.delete(other.id);
          }
        }
        next.add(id);
      }
      return next;
    });
  }

  // คิวอาบน้ำ/บริการอื่นๆ — โหลดช่วงเวลาว่างของวันที่เลือกใหม่ทุกครั้งที่เปลี่ยนวัน/ประเภท
  useEffect(() => {
    if (kind === "BOARDING") return;
    let active = true;
    const timeoutId = setTimeout(() => {
      setLoadingSlots(true);
      setTime("");
      getOpenSlots(date, kind).then((result) => {
        if (!active) return;
        setSlots(result);
        setLoadingSlots(false);
      });
    }, 0);
    return () => {
      active = false;
      clearTimeout(timeoutId);
    };
  }, [date, kind]);

  const selectedRoom = rooms.find((r) => r.id === roomId) ?? null;
  const isPerVisit = selectedRoom?.category.billingUnit === "PER_VISIT";
  // ห้องรายครั้ง (Daycare/Pawsome) ปกติคิด "1 ครั้ง" (nights=0) แต่ถ้าจองข้ามวันให้คิดราคาเหมือน
  // ห้องรายคืนทั่วไป (เหมือนที่ server บังคับใน buildOrderPlan) กันตัวเลขราคาที่แสดงไม่ตรงกับที่เก็บจริง
  const nights =
    selectedRoom && (!isPerVisit || checkInDate !== checkOutDate)
      ? Math.max(1, daysBetween(checkInDate, checkOutDate))
      : 0;

  const roomsByCategory = useMemo(() => {
    const map = new Map<string, { categoryName: string; rooms: Room[] }>();
    for (const r of rooms) {
      const entry = map.get(r.categoryId) ?? { categoryName: r.category.name, rooms: [] };
      entry.rooms.push(r);
      map.set(r.categoryId, entry);
    }
    return [...map.values()];
  }, [rooms]);

  function onRoomChange(id: string) {
    setRoomId(id);
    if (checkOutDate <= checkInDate) setCheckOutDate(addDaysThai(checkInDate, 1));
  }

  function onCheckInDateChange(v: string) {
    setCheckInDate(v);
    const suggested = addOneHour(checkInTime);
    const suggestedHour = Number(suggested.split(":")[0]);
    setCheckOutTime(suggestedHour > 20 ? "20:00" : suggested);
    if (checkOutDate <= v) setCheckOutDate(addDaysThai(v, 1));
  }

  // เช็คห้องว่างแบบ live ทุกครั้งที่เปลี่ยนห้อง/วัน-เวลา ก่อนให้กดยืนยันจริง
  useEffect(() => {
    const skip = kind !== "BOARDING" || !roomId;
    const timeoutId = setTimeout(
      () => {
        if (skip) {
          setRoomAvailable(null);
          return;
        }
        setCheckingRoom(true);
        setRoomAvailable(null);
        checkRoomAvailability(roomId, checkInDate, checkInTime, checkOutDate, checkOutTime)
          .then(setRoomAvailable)
          .finally(() => setCheckingRoom(false));
      },
      skip ? 0 : 300
    );
    return () => clearTimeout(timeoutId);
  }, [kind, roomId, checkInDate, checkInTime, checkOutDate, checkOutTime]);

  const nannyFee = kind !== "BOARDING" || !selectedRoom
    ? 0
    : nannyType === "REGULAR"
      ? NANNY_REGULAR_RATE * (nights > 0 ? nights : 1)
      : nannyType === "VIP"
        ? NANNY_VIP_RATE
        : 0;
  const cctvFee = kind === "BOARDING" && selectedRoom && cctvRequested ? CCTV_ROOM_RATE : 0;

  const total = useMemo(() => {
    let sum = 0;
    for (const s of services) if (serviceIds.has(s.id)) sum += s.price;
    if (kind === "BOARDING" && selectedRoom) sum += selectedRoom.pricePerNight * (nights > 0 ? nights : 1);
    return sum + nannyFee + cctvFee;
  }, [services, serviceIds, kind, selectedRoom, nights, nannyFee, cctvFee]);

  const depositAmount = kind === "BATH" ? Math.min(BATH_DEPOSIT_AMOUNT, total) : 0;

  const canSubmit =
    !!petId &&
    total > 0 &&
    (kind === "BOARDING" ? !!roomId && roomAvailable === true : !!time);

  function submit() {
    if (!idToken || !petId) return;
    const payload =
      kind === "BOARDING"
        ? {
            petId,
            roomId,
            checkInDate,
            checkInTime,
            checkOutDate,
            checkOutTime,
            nannyType,
            cctvRequested,
            note,
            serviceIds: [...serviceIds],
            queueType: "BATH" as const,
          }
        : {
            petId,
            roomId: null,
            note,
            serviceIds: [...serviceIds],
            appointmentDate: date,
            appointmentTime: time,
            queueType: kind,
          };

    startTransition(async () => {
      const res = await liffCreateOrder(idToken, payload);
      if (!res.ok) {
        handleLiffAuthExpiry(res);
        toast.error(res.error);
        return;
      }
      router.push(`/liff/pay/${res.id}`);
    });
  }

  if (loadingCustomer) {
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center gap-3 p-6 text-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <p className="text-sm text-muted-foreground">{t.liff.loadingTitle}</p>
      </div>
    );
  }

  if (pets.length === 0) {
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center gap-2 p-6 text-center text-sm text-muted-foreground">
        {t.liff.noPetsFound}
      </div>
    );
  }

  return (
    <div className="space-y-5 pb-24">
      <PageHeader title={t.liff.bookPageTitle} />

      {/* สัตว์เลี้ยง */}
      <div className="space-y-2">
        <Label>{t.liff.petSectionTitle}</Label>
        <Select
          value={petId}
          onValueChange={(v) => setPetId(v ?? "")}
          items={pets.map((p) => ({
            value: p.id,
            label: (
              <span className="flex items-center gap-1.5">
                <SpeciesIcon species={p.species} className="h-4 w-4" /> {p.name}
              </span>
            ),
          }))}
        >
          <SelectTrigger className="w-full">
            <SelectValue placeholder={t.liff.selectPetPlaceholder} />
          </SelectTrigger>
          <SelectContent>
            {pets.map((p) => (
              <SelectItem key={p.id} value={p.id}>
                <span className="flex items-center gap-1.5">
                  <SpeciesIcon species={p.species} className="h-4 w-4" /> {p.name}
                </span>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* ประเภทการจอง */}
      <Tabs value={kind} onValueChange={(v) => v && setKind(v as Kind)}>
        <TabsList className="w-full">
          <TabsTrigger value="BATH" className="flex-1">{t.liff.bookingTypeBath}</TabsTrigger>
          <TabsTrigger value="BOARDING" className="flex-1">{t.liff.bookingTypeBoarding}</TabsTrigger>
          <TabsTrigger value="OTHER" className="flex-1">{t.liff.bookingTypeOther}</TabsTrigger>
        </TabsList>
      </Tabs>

      {kind !== "BOARDING" ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">{t.liff.selectDateLabel}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <DateSelect value={date} min={todayStr()} onChange={setDate} />
            <Label className="text-base font-medium">{t.liff.selectSlotLabel}</Label>
            {loadingSlots ? (
              <div className="flex justify-center py-4">
                <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
              </div>
            ) : slots.every((s) => !s.available) ? (
              <p className="py-2 text-center text-sm text-muted-foreground">{t.liff.noSlotsAvailable}</p>
            ) : (
              <TimeWheelPicker slots={slots} value={time} onChange={setTime} />
            )}
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">{t.liff.selectRoomLabel}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <Select
              value={roomId}
              onValueChange={(v) => onRoomChange(v ?? "")}
              items={rooms.map((r) => ({
                value: r.id,
                label: `${r.category.name} · ${r.name} · ${formatBaht(r.pricePerNight)}`,
              }))}
            >
              <SelectTrigger className="w-full">
                <SelectValue placeholder={t.liff.selectRoomLabel} />
              </SelectTrigger>
              <SelectContent>
                {roomsByCategory.map(({ categoryName, rooms: roomsInCat }) => (
                  <SelectGroup key={categoryName}>
                    <SelectLabel>{categoryName}</SelectLabel>
                    {roomsInCat.map((r) => (
                      <SelectItem key={r.id} value={r.id}>
                        {r.name} · {formatBaht(r.pricePerNight)}/
                        {r.category.billingUnit === "PER_NIGHT" ? t.orders.form.perNightUnit : t.orders.form.perVisitUnit}
                      </SelectItem>
                    ))}
                  </SelectGroup>
                ))}
              </SelectContent>
            </Select>

            {selectedRoom && (
              <>
                <div className="grid gap-3">
                  <div className="space-y-1.5">
                    <Label className="text-xs">{t.orders.form.checkInLabel}</Label>
                    <div className="space-y-2">
                      <DateSelect value={checkInDate} min={todayStr()} onChange={onCheckInDateChange} />
                      <TimeSelect value={checkInTime} onChange={setCheckInTime} minHour={9} maxHour={20} />
                    </div>
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs">{t.orders.form.checkOutLabel}</Label>
                    <div className="space-y-2">
                      <DateSelect value={checkOutDate} min={checkInDate} onChange={setCheckOutDate} />
                      <TimeSelect value={checkOutTime} onChange={setCheckOutTime} minHour={9} maxHour={20} />
                    </div>
                  </div>
                </div>
                {nights > 0 && (
                  <p className="text-xs text-muted-foreground">{t.orders.form.nightsCount(nights)}</p>
                )}

                {checkingRoom ? (
                  <p className="text-xs text-muted-foreground">{t.liff.checkingAvailability}</p>
                ) : roomAvailable === false ? (
                  <p className="text-xs font-medium text-destructive">{t.liff.roomUnavailable}</p>
                ) : null}

                <div className="space-y-1.5">
                  <Label className="text-xs">{t.liff.nannyLabel}</Label>
                  <div className="grid grid-cols-3 gap-2">
                    {(["NONE", "REGULAR", "VIP"] as const).map((opt) => (
                      <button
                        key={opt}
                        type="button"
                        onClick={() => setNannyType(opt)}
                        className={cn(
                          "rounded-lg border p-2.5 text-center text-xs transition-colors",
                          nannyType === opt ? "border-primary bg-primary/10 font-medium" : "hover:bg-accent"
                        )}
                      >
                        <div>
                          {opt === "NONE"
                            ? t.orders.form.nannyNone
                            : opt === "REGULAR"
                              ? t.orders.form.nannyRegular
                              : t.orders.form.nannyVip}
                        </div>
                        {opt !== "NONE" && (
                          <div className="text-muted-foreground">
                            {formatBaht(opt === "REGULAR" ? NANNY_REGULAR_RATE : NANNY_VIP_RATE)}
                            {opt === "REGULAR" ? t.orders.form.perNightUnitSuffix : t.liff.nannyVipSuffix}
                          </div>
                        )}
                      </button>
                    ))}
                  </div>
                </div>

                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={cctvRequested}
                    onChange={(e) => setCctvRequested(e.target.checked)}
                    className="h-4 w-4 accent-primary"
                  />
                  {t.liff.cctvLabel} ({formatBaht(CCTV_ROOM_RATE)})
                </label>
              </>
            )}
          </CardContent>
        </Card>
      )}

      {/* บริการเสริม */}
      {(pickableServices.length > 0 || defaultOnServices.length > 0) && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">{t.liff.servicesSectionTitle}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {pickableServices.length > 0 && (
              <div className="grid gap-2">
                {pickableServices.map((s) => {
                  const active = serviceIds.has(s.id);
                  return (
                    <button
                      key={s.id}
                      type="button"
                      onClick={() => toggleService(s.id)}
                      className={cn(
                        "flex items-center justify-between rounded-lg border p-3 text-left text-sm transition-colors",
                        active ? "border-primary bg-primary/10" : "hover:bg-accent"
                      )}
                    >
                      <span className={cn(active && "font-medium")}>{s.name}</span>
                      <span className="text-muted-foreground">{formatBaht(s.price)}</span>
                    </button>
                  );
                })}
              </div>
            )}
            {defaultOnServices.length > 0 && (
              <div>
                <div className="mb-2 text-xs font-medium text-muted-foreground">
                  {t.liff.defaultServicesTitle}
                </div>
                <div className="grid gap-2">
                  {defaultOnServices.map((s) => {
                    const active = serviceIds.has(s.id);
                    return (
                      <button
                        key={s.id}
                        type="button"
                        onClick={() => toggleService(s.id)}
                        className={cn(
                          "flex items-center justify-between rounded-lg border p-3 text-left text-sm transition-colors",
                          active ? "border-primary bg-primary/10" : "hover:bg-accent"
                        )}
                      >
                        <span className={cn(active && "font-medium")}>{s.name}</span>
                        <span className="text-muted-foreground">{formatBaht(s.price)}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      <div className="space-y-1.5">
        <Label className="text-xs">{t.orders.form.noteLabel}</Label>
        <Textarea value={note} onChange={(e) => setNote(e.target.value)} rows={2} className="bg-background" />
      </div>

      {/* สรุป + ปุ่มยืนยัน แปะด้านล่างจอเสมอ */}
      <div className="fixed inset-x-3 bottom-3 z-10 mx-auto max-w-md rounded-xl border bg-background p-4 shadow-[0_-2px_10px_rgba(0,0,0,0.08)]">
        <div className="mb-2 flex items-center justify-between text-sm">
          <span className="text-muted-foreground">
            {kind === "BATH" && depositAmount > 0 ? t.orders.form.depositLabel : t.orders.form.grandTotal}
          </span>
          <span className="text-lg font-bold text-primary">
            {formatBaht(kind === "BATH" && depositAmount > 0 ? depositAmount : total)}
          </span>
        </div>
        <Button className="w-full" size="lg" onClick={submit} disabled={isPending || !canSubmit}>
          {isPending ? <Loader2 className="animate-spin" /> : <ClipboardCheck />}
          {t.liff.confirmBookingButton}
        </Button>
      </div>
    </div>
  );
}

export function LiffBookingForm() {
  return (
    <LiffGate>
      <BookingBody />
    </LiffGate>
  );
}
