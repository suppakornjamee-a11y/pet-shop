"use client";

import { Fragment, useEffect, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  ArrowLeft,
  Bath,
  Check,
  ChevronLeft,
  ChevronRight,
  Clock,
  Home,
  Loader2,
  Scissors,
  Sunrise,
  Sun,
  Sunset,
  XCircle,
  CalendarCheck,
} from "lucide-react";
import {
  liffBootstrap,
  getBookableServices,
  getBookableRooms,
  checkRoomAvailability,
  getOpenSlots,
  liffCreateOrder,
  liffCancelOrder,
  getLiffOrderPaymentStatus,
} from "@/app/actions/liff";
import { formatBaht, formatDateLong } from "@/lib/format";
import { toThaiDateStr, addDaysThai, daysBetween, thaiDayRange } from "@/lib/slots";
import { cn } from "@/lib/utils";
import { SpeciesIcon } from "@/components/species-icon";
import { useLiff, LiffGate, handleLiffAuthExpiry } from "@/components/liff-provider";
import { useI18n } from "@/components/i18n-provider";
import { useConfirm } from "@/components/confirm-provider";
import { LiffPaymentBody } from "@/components/liff-payment-view";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
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
/** 1 เลือกบริการ · 2 เลือกวันเวลา · 3 รอพนักงานเช็คคิว · 4 ชำระเงิน · 5 รอร้านดำเนินการ */
type Step = 1 | 2 | 3 | 4 | 5;
/** ถามสถานะออเดอร์ถี่แค่ไหนตอนรอพนักงานเช็คคิว — เท่ากับหน้าชำระเงินใช้อยู่ */
const APPROVAL_POLL_MS = 8000;

/** สรุปการจองที่สร้างสำเร็จแล้ว — เก็บจาก state ฝั่งนี้ตอนกดยืนยัน ไม่ต้องยิงถามเซิร์ฟเวอร์ซ้ำ
 * เพราะทุกค่าที่หน้าสรุปต้องใช้ ผู้ใช้เพิ่งกรอกเองมาทั้งหมด */
type BookingDone = {
  orderId: string;
  kind: Kind;
  serviceLabel: string;
  petName: string;
  /** ชื่อรายการที่ลูกค้าเลือกไว้ (ห้องพัก + บริการที่ติ๊ก) — โชว์ตัวเล็กในหน้าสรุป */
  items: string[];
  total: number;
  date: string;
  time: string;
  checkOutDate: string | null;
};

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
const SELECT_CLASS =
  "h-10 w-full min-w-0 rounded-xl border bg-card px-1.5 text-center text-sm";

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

/* ---------- ปฏิทินรายเดือน ---------- */

// เรียงวันแบบเริ่มวันจันทร์ (ไม่ใช่อาทิตย์เหมือนปฏิทินฝั่งพนักงาน) ตามแบบที่ออกแบบไว้ให้ลูกค้า
const WEEKDAY_LABELS = ["จ", "อ", "พ", "พฤ", "ศ", "ส", "อา"];

/** ช่องว่างนำหน้าวันที่ 1 ของเดือน เมื่อสัปดาห์เริ่มที่วันจันทร์ (getDay(): 0=อาทิตย์) */
function leadingBlanks(year: number, month: number): number {
  return (new Date(year, month - 1, 1).getDay() + 6) % 7;
}

function MonthCalendar({
  value,
  min,
  onChange,
}: {
  value: string;
  min: string;
  onChange: (v: string) => void;
}) {
  const selected = parseDateStr(value);
  const [view, setView] = useState({ y: selected.y, m: selected.m });
  const today = todayStr();

  const total = daysInMonth(view.y, view.m);
  const blanks = leadingBlanks(view.y, view.m);
  const monthLabel = new Intl.DateTimeFormat("th-TH", { month: "long", year: "numeric" }).format(
    new Date(view.y, view.m - 1, 1)
  );

  // เดือนก่อนหน้ากดถอยได้แค่ถึงเดือนของวันที่เร็วที่สุดที่จองได้ ไม่ปล่อยให้ถอยไปเรื่อยๆ จนหลง
  const minParts = parseDateStr(min);
  const canGoBack = view.y > minParts.y || (view.y === minParts.y && view.m > minParts.m);

  function shiftMonth(delta: number) {
    const next = new Date(view.y, view.m - 1 + delta, 1);
    setView({ y: next.getFullYear(), m: next.getMonth() + 1 });
  }

  return (
    <div className="rounded-2xl border bg-card p-4">
      <div className="mb-3 flex items-center justify-between">
        <span className="text-sm font-semibold">{monthLabel}</span>
        <div className="flex gap-1">
          <button
            type="button"
            onClick={() => shiftMonth(-1)}
            disabled={!canGoBack}
            aria-label="เดือนก่อนหน้า"
            className="flex h-8 w-8 items-center justify-center rounded-full border text-muted-foreground transition-colors hover:bg-muted disabled:opacity-30"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={() => shiftMonth(1)}
            aria-label="เดือนถัดไป"
            className="flex h-8 w-8 items-center justify-center rounded-full border text-muted-foreground transition-colors hover:bg-muted"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
      </div>

      <div className="grid grid-cols-7 gap-1 text-center text-[11px] text-muted-foreground">
        {WEEKDAY_LABELS.map((w) => (
          <div key={w} className="py-1">
            {w}
          </div>
        ))}
      </div>

      <div className="grid grid-cols-7 gap-1">
        {Array.from({ length: blanks }, (_, i) => (
          <div key={`blank-${i}`} />
        ))}
        {Array.from({ length: total }, (_, i) => i + 1).map((day) => {
          const dateStr = formatDateStr(view.y, view.m, day);
          const isPast = dateStr < min;
          const isSelected = dateStr === value;
          const isToday = dateStr === today;
          return (
            <button
              key={day}
              type="button"
              disabled={isPast}
              onClick={() => onChange(dateStr)}
              className={cn(
                "relative flex h-10 items-center justify-center rounded-xl text-sm transition-colors sm:h-12",
                isPast && "text-muted-foreground/35",
                !isPast && !isSelected && "hover:bg-muted",
                isSelected && "bg-primary font-semibold text-primary-foreground"
              )}
            >
              {day}
              {isToday && !isSelected && (
                <span className="absolute bottom-1.5 h-1 w-1 rounded-full bg-primary" />
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}

/* ---------- ช่วงเวลา แบ่งเป็นเช้า/บ่าย/เย็น ---------- */

type SlotGroup = { key: "MORNING" | "AFTERNOON" | "EVENING"; label: string; icon: typeof Sunrise; slots: SlotOption[] };

function hourOf(time: string): number {
  return Number(time.split(":")[0]);
}

/** ป้ายช่วงเวลาจริงของกลุ่ม (เช่น "10:00 – 11:30") คำนวณจากช่วงที่มีอยู่จริง ไม่ฮาร์ดโค้ด
 * เพราะรายการช่วงเวลาที่เปิดให้จอง (LIFF_TIME_SLOTS) ปรับได้จากฝั่งเซิร์ฟเวอร์ */
function groupRangeLabel(slots: SlotOption[]): string {
  if (slots.length === 0) return "";
  return `${slots[0].time} – ${slots[slots.length - 1].time}`;
}

function TimeSlotGroups({
  slots,
  value,
  onChange,
  t,
}: {
  slots: SlotOption[];
  value: string;
  onChange: (time: string) => void;
  t: ReturnType<typeof useI18n>["t"];
}) {
  const groups: SlotGroup[] = [
    { key: "MORNING", label: t.liff.morningLabel, icon: Sunrise, slots: slots.filter((s) => hourOf(s.time) < 12) },
    {
      key: "AFTERNOON",
      label: t.liff.afternoonLabel,
      icon: Sun,
      slots: slots.filter((s) => hourOf(s.time) >= 12 && hourOf(s.time) < 16),
    },
    { key: "EVENING", label: t.liff.eveningLabel, icon: Sunset, slots: slots.filter((s) => hourOf(s.time) >= 16) },
  ];

  return (
    <div className="space-y-4">
      {groups
        .filter((g) => g.slots.length > 0)
        .map((g) => {
          return (
            <div key={g.key} className="space-y-2">
              <div className="flex items-center gap-2 text-xs">
                <g.icon className="h-3.5 w-3.5 shrink-0 text-primary" />
                <span className="font-medium">{g.label}</span>
                <span className="text-muted-foreground">{groupRangeLabel(g.slots)}</span>
              </div>
              <div className="grid grid-cols-3 gap-2 sm:grid-cols-4 md:grid-cols-5">
                {g.slots.map((s) => {
                  const isSelected = s.time === value;
                  return (
                    <button
                      key={s.time}
                      type="button"
                      disabled={!s.available}
                      onClick={() => onChange(s.time)}
                      className={cn(
                        "flex items-center justify-center gap-1.5 rounded-xl border py-2.5 text-sm transition-colors",
                        !s.available && "border-transparent bg-muted text-muted-foreground/50 line-through",
                        s.available && !isSelected && "bg-card hover:border-primary/50",
                        isSelected && "border-primary bg-primary font-semibold text-primary-foreground"
                      )}
                    >
                      {s.available && !isSelected && (
                        <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-primary" />
                      )}
                      {s.time}
                    </button>
                  );
                })}
              </div>
            </div>
          );
        })}
    </div>
  );
}

/* ---------- ส่วนหัวของแต่ละขั้น ---------- */

/** แถบบอกขั้นตอน — วงกลมต่อกันด้วยเส้นประ ขั้นที่ผ่านแล้วขึ้นเครื่องหมายถูก ขั้นปัจจุบันเป็นวงทึบ
 * ใช้ชุดเดียวกันทั้งสามหน้า ลูกค้าจะได้รู้ตลอดว่าอยู่ตรงไหนและเหลืออีกกี่ขั้น */
const STEP_ICONS = [
  "/images/icons/step-service.png",
  "/images/icons/step-queue.png",
  "/images/icons/step-checking.png",
  "/images/icons/step-pay.png",
  "/images/icons/step-progress.png",
];

/** ไอคอนขั้นตอนเป็น PNG ลายเส้นสีดำล้วน — ระบายสีตาม currentColor ด้วย mask แทนการโหลดรูปหลายสี
 * ทำให้ไอคอนเปลี่ยนสีตามสถานะของขั้นตอนได้ (ขาวบนพื้นชมพู / ชมพู / เทาจาง) โดยใช้ไฟล์เดียว */
function StepIcon({ src, className }: { src: string; className?: string }) {
  return (
    <span
      aria-hidden
      className={cn("bg-current", className)}
      style={{
        maskImage: `url(${src})`,
        WebkitMaskImage: `url(${src})`,
        maskSize: "contain",
        WebkitMaskSize: "contain",
        maskRepeat: "no-repeat",
        WebkitMaskRepeat: "no-repeat",
        maskPosition: "center",
        WebkitMaskPosition: "center",
      }}
    />
  );
}

/**
 * แถบบอกขั้นตอน — ไอคอนเปล่าๆ ไม่มีวงกลมครอบ ทุกอันขนาดเท่ากัน (ไฟล์ PNG ถูก trim + ใส่ขอบ
 * ให้เนื้อไอคอนกินพื้นที่เท่ากันทุกใบแล้ว จึงดูสมดุลกันจริงแม้รูปทรงจะต่างกัน)
 *
 * onJump มีเฉพาะตอนที่ยังแก้ไขการจองได้ — กดย้อนไปขั้นก่อนหน้าได้ แต่กดข้ามไปข้างหน้าไม่ได้
 * และพอส่งคำขอจองไปแล้ว (ขั้น 3) จะกดไม่ได้ทั้งแถบ เพราะออเดอร์ถูกสร้างในระบบไปแล้ว
 * ย้อนกลับไปแก้แล้วกดยืนยันซ้ำจะกลายเป็นจองซ้ำสองใบ
 */
function Stepper({
  step,
  t,
  onJump,
}: {
  step: Step;
  t: ReturnType<typeof useI18n>["t"];
  onJump?: (step: Step) => void;
}) {
  const labels = [
    t.liff.stepChooseService,
    t.liff.stepBookQueue,
    t.liff.stepAwaitReview,
    t.liff.stepPayment,
    t.liff.stepInProgress,
  ];
  return (
    <div className="flex items-start">
      {labels.map((label, i) => {
        const n = (i + 1) as Step;
        const passed = n < step;
        const current = n === step;
        const canJump = !!onJump && passed;
        return (
          <Fragment key={label}>
            <button
              type="button"
              disabled={!canJump}
              onClick={canJump ? () => onJump(n) : undefined}
              className={cn(
                "flex w-14 shrink-0 flex-col items-center gap-1 rounded-xl py-1 transition-colors",
                canJump && "cursor-pointer hover:bg-accent/30",
                !canJump && "cursor-default"
              )}
            >
              <StepIcon
                src={STEP_ICONS[i]}
                className={cn(
                  "h-8 w-8 transition-colors",
                  passed || current ? "text-primary" : "text-muted-foreground/35"
                )}
              />
              <span
                className={cn(
                  "text-center text-[10px] leading-tight",
                  passed || current ? "font-medium text-primary" : "text-muted-foreground"
                )}
              >
                {label}
              </span>
            </button>
            {i < labels.length - 1 && (
              <div
                className={cn(
                  "mt-4 flex-1 border-t-2 border-dashed",
                  passed ? "border-primary" : "border-border"
                )}
              />
            )}
          </Fragment>
        );
      })}
    </div>
  );
}

const KIND_ICONS: Record<Kind, typeof Home> = {
  BOARDING: Home,
  OTHER: Scissors,
  BATH: Bath,
};

/* ---------- ตัวฟอร์มหลัก ---------- */

function BookingBody() {
  const { t } = useI18n();
  const router = useRouter();
  const { idToken } = useLiff();
  const confirm = useConfirm();
  const [isPending, startTransition] = useTransition();

  const [step, setStep] = useState<Step>(1);
  // ออเดอร์ถูกปฏิเสธคิว — แยกจาก done เพราะยังต้องโชว์สรุปเดิมไว้ให้ลูกค้าอ่าน
  const [rejected, setRejected] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [cancelOpen, setCancelOpen] = useState(false);
  const [cancelReason, setCancelReason] = useState("");
  const [done, setDone] = useState<BookingDone | null>(null);

  const [loadingCustomer, setLoadingCustomer] = useState(true);
  const [pets, setPets] = useState<Pet[]>([]);
  const [petId, setPetId] = useState("");

  const [kind, setKind] = useState<Kind>("BATH");
  const [services, setServices] = useState<Service[]>([]);
  // นับรอบการโหลดรายการบริการ — ใช้เป็นสัญญาณว่า "ต้องติ๊กบริการฟรีใหม่" (ดูบล็อกด้านล่าง)
  const [servicesVersion, setServicesVersion] = useState(0);
  const [serviceIds, setServiceIds] = useState<Set<string>>(new Set());

  const [date, setDate] = useState(todayStr());
  const [slots, setSlots] = useState<SlotOption[]>([]);
  const [time, setTime] = useState("");
  const [loadingSlots, setLoadingSlots] = useState(false);

  const [rooms, setRooms] = useState<Room[]>([]);
  const [roomId, setRoomId] = useState("");
  const [checkInTime, setCheckInTime] = useState("13:00");
  const [checkOutDate, setCheckOutDate] = useState(addDaysThai(todayStr(), 1));
  const [checkOutTime, setCheckOutTime] = useState("11:00");
  const [roomAvailable, setRoomAvailable] = useState<boolean | null>(null);
  const [checkingRoom, setCheckingRoom] = useState(false);
  const [nannyType, setNannyType] = useState<"NONE" | "REGULAR" | "VIP">("NONE");
  const [cctvRequested, setCctvRequested] = useState(false);

  const [note, setNote] = useState("");

  // โรงแรมใช้ปฏิทินเดียวกันเป็นวันเช็คอิน เพื่อไม่ต้องมีตัวเลือกวันสองชุดคนละหน้าตาในหน้าเดียวกัน
  const checkInDate = date;

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
        setServicesVersion((v) => v + 1);
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

  // ติ๊ก "บริการฟรี" (รายการที่รวมอยู่ในราคาแล้ว) ให้อัตโนมัติทุกประเภทการจอง — ลูกค้าถอนออกเองได้
  // ผูกกับ servicesVersion ด้วย เพื่อให้ติ๊กใหม่ทุกครั้งที่รายการโหลดมาใหม่ ไม่ใช่แค่ครั้งแรก
  // (ไม่งั้นถอยกลับไปเปลี่ยนบริการแล้ววนกลับมาอันเดิม รายการที่เพิ่งถูกล้างจะไม่ถูกติ๊กคืน)
  // ปรับ state ระหว่าง render โดยตรง (ไม่ใช้ useEffect) เพื่อเลี่ยง cascading render ตาม React docs
  // "You Might Not Need an Effect" — เทียบค่าล่าสุดที่เคย apply ไปแล้วก่อนค่อยตัดสินใจ setState
  const defaultOnKey = `${servicesVersion}|${defaultOnServices.map((s) => s.id).join(",")}`;
  const [appliedDefaultOnKey, setAppliedDefaultOnKey] = useState("");
  if (services.length > 0 && defaultOnKey !== appliedDefaultOnKey) {
    setAppliedDefaultOnKey(defaultOnKey);
    // ถอนบริการฟรีของชนิดสัตว์เดิมออกก่อนเสมอ ไม่งั้นสลับหมา↔แมวแล้วจะเหลือรายการของอีกชนิดค้างไว้
    // แล้วโดนคิดเงินจริงตอนเซิร์ฟเวอร์คำนวณราคาซ้ำ
    const everyDefaultId = new Set(services.filter((s) => s.defaultOn).map((s) => s.id));
    const wantedIds = defaultOnServices.map((s) => s.id);
    setServiceIds((prev) => {
      const next = new Set([...prev].filter((id) => !everyDefaultId.has(id)));
      for (const id of wantedIds) next.add(id);
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

  function onDateChange(v: string) {
    setDate(v);
    if (kind !== "BOARDING") return;
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

  const nannyFee =
    kind !== "BOARDING" || !selectedRoom
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

  const kindLabel =
    kind === "BATH" ? t.liff.bookingTypeBath : kind === "OTHER" ? t.liff.bookingTypeOther : t.liff.bookingTypeBoarding;
  const kindSubtitle =
    kind === "BATH"
      ? t.liff.kindBathSubtitle
      : kind === "OTHER"
        ? t.liff.kindOtherSubtitle
        : t.liff.kindBoardingSubtitle;

  const canSubmit =
    !!petId && total > 0 && (kind === "BOARDING" ? !!roomId && roomAvailable === true : !!time);

  /** ชื่อรายการที่เลือกไว้ตอนนี้ เรียงตามที่ลูกค้าเห็นในฟอร์ม — ห้องพักก่อน แล้วค่อยบริการที่ติ๊ก */
  const selectedItemNames = [
    ...(kind === "BOARDING" && selectedRoom
      ? [`${selectedRoom.category.name} · ${selectedRoom.name}`]
      : []),
    ...speciesFilteredServices.filter((s) => serviceIds.has(s.id)).map((s) => s.name),
  ];

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
      setDone({
        // ไม่มี id กลับมาแปลว่าเราไม่รู้ว่าจะยกเลิกออเดอร์ไหน — ปุ่มยกเลิกจะซ่อนไปเอง
        // (ดีกว่าโชว์ปุ่มที่กดแล้วพัง) ส่วนตัวการจองสร้างสำเร็จแล้วจึงยังพาไปหน้าสรุปตามปกติ
        orderId: res.id ?? "",
        kind,
        serviceLabel: kindLabel,
        petName: selectedPet?.name ?? "",
        items: selectedItemNames,
        total,
        date: kind === "BOARDING" ? checkInDate : date,
        time: kind === "BOARDING" ? checkInTime : time,
        checkOutDate: kind === "BOARDING" ? checkOutDate : null,
      });
      setConfirmOpen(false);
      setStep(3);
    });
  }

  /** ยกเลิกคำขอจองที่เพิ่งส่งไป แล้วพากลับไปเริ่มใหม่ที่ขั้นแรก */
  async function cancelBooking() {
    if (!idToken || !done) return;
    // เหลือแค่สองปุ่มเหมือนกล่องยืนยันการจอง (srTitle ไว้ให้ screen reader อ่าน)
    const ok = await confirm({
      confirmLabel: t.liff.cancelBookingButton,
      srTitle: t.liff.confirmCancelBookingTitle,
      tone: "danger",
    });
    if (!ok) return;

    startTransition(async () => {
      const res = await liffCancelOrder(idToken, done.orderId);
      if (!res.ok) {
        handleLiffAuthExpiry(res);
        toast.error(res.error);
        return;
      }
      toast.success(res.message);
      setDone(null);
      setRejected(false);
      setTime("");
      setStep(1);
    });
  }

  /**
   * ยกเลิกจากหน้าชำระเงิน — ตรงนี้ร้านยืนยันคิวให้แล้ว ลูกค้าเลยควรบอกเหตุผลไว้ให้ร้านรู้
   * backTo ใส่มาเมื่อกดย้อนจากแถบขั้นตอน (ยกเลิกใบเดิมแล้วพากลับไปเลือกวันเวลาใหม่)
   */
  function cancelFromPayment(reason: string, backTo: Step) {
    if (!idToken || !done) return;
    startTransition(async () => {
      const res = await liffCancelOrder(idToken, done.orderId, reason);
      if (!res.ok) {
        handleLiffAuthExpiry(res);
        toast.error(res.error);
        return;
      }
      toast.success(res.message);
      setCancelOpen(false);
      setCancelReason("");
      setDone(null);
      setRejected(false);
      setTime("");
      setStep(backTo);
    });
  }

  /** กดแถบขั้นตอนย้อนกลับจากหน้าชำระเงิน — ต้องยกเลิกใบเดิมก่อน ไม่งั้นจองซ้ำสองใบ */
  async function jumpBackFromPayment(target: Step) {
    const ok = await confirm({
      title: t.liff.changeBookingTitle,
      description: t.liff.changeBookingHint,
      confirmLabel: t.liff.changeBookingConfirm,
      tone: "danger",
    });
    if (!ok) return;
    cancelFromPayment("", target);
  }

  // ขั้น "รอตรวจสอบ" — ถามสถานะออเดอร์เองเรื่อยๆ พอพนักงานกดยืนยันคิว หน้าจอลูกค้าจะเด้งไป
  // ขั้นชำระเงินต่อให้เลย ไม่ต้องรอกดลิงก์จาก LINE (ลิงก์ยังส่งอยู่ เผื่อลูกค้าปิดแอปไปแล้ว)
  useEffect(() => {
    if (step !== 3 || !idToken || !done?.orderId || rejected) return;
    let active = true;
    let timeoutId: ReturnType<typeof setTimeout>;

    async function poll() {
      const res = await getLiffOrderPaymentStatus(idToken!, done!.orderId);
      if (!active) return;
      if (!res.ok) {
        handleLiffAuthExpiry(res);
        timeoutId = setTimeout(poll, APPROVAL_POLL_MS);
        return;
      }
      if (res.status === "CANCELLED") {
        setRejected(true);
        return;
      }
      if (res.status !== "PENDING_APPROVAL") {
        setStep(4);
        return;
      }
      timeoutId = setTimeout(poll, APPROVAL_POLL_MS);
    }

    timeoutId = setTimeout(poll, APPROVAL_POLL_MS);
    return () => {
      active = false;
      clearTimeout(timeoutId);
    };
  }, [step, idToken, done, rejected]);

  // ขั้น "ชำระเงิน" — พอร้านยืนยันเงินครบแล้ว เลื่อนไปขั้นรอดำเนินการต่อเอง
  // (หน้าชำระเงินข้างในก็ถามสถานะของมันเองอยู่ ตัวนี้ถามแยกเพื่อรู้ว่าจะเปลี่ยนขั้นตอนเมื่อไหร่)
  useEffect(() => {
    if (step !== 4 || !idToken || !done?.orderId) return;
    let active = true;
    let timeoutId: ReturnType<typeof setTimeout>;

    async function poll() {
      const res = await getLiffOrderPaymentStatus(idToken!, done!.orderId);
      if (!active) return;
      if (res.ok) {
        const verified = res.payments
          .filter((p) => p.status === "VERIFIED")
          .reduce((sum, p) => sum + p.amount, 0);
        if (res.total > 0 && verified >= res.total) {
          setStep(5);
          return;
        }
      }
      timeoutId = setTimeout(poll, APPROVAL_POLL_MS);
    }

    timeoutId = setTimeout(poll, APPROVAL_POLL_MS);
    return () => {
      active = false;
      clearTimeout(timeoutId);
    };
  }, [step, idToken, done]);

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

  /* ---------- ขั้นที่ 5: รอร้านดำเนินการ ---------- */
  if (step === 5 && done) {
    return (
      <div className="space-y-6 py-4">
        <Stepper step={5} t={t} />

        <div className="flex flex-col items-center gap-3 pt-4 text-center">
          <div className="flex h-16 w-16 items-center justify-center rounded-full bg-accent/40">
            <span className="flex h-11 w-11 items-center justify-center rounded-full bg-primary">
              <Check className="h-5 w-5 text-primary-foreground" strokeWidth={3} />
            </span>
          </div>
          <h1 className="text-xl font-bold tracking-tight">{t.liff.inProgressTitle}</h1>
        </div>

        <div className="rounded-2xl border bg-card p-4">
          <div className="flex items-start gap-3">
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-accent/40">
              {(() => {
                const Icon = KIND_ICONS[done.kind];
                return <Icon className="h-5 w-5 text-primary" />;
              })()}
            </span>
            <div className="min-w-0 flex-1">
              <div className="font-semibold">{done.serviceLabel}</div>
              {done.petName && <div className="text-xs text-muted-foreground">{done.petName}</div>}
            </div>
            <div className="font-semibold text-primary">{formatBaht(done.total)}</div>
          </div>

          <div className="my-4 border-t border-dashed" />

          <dl className="space-y-2.5 text-sm">
            <div className="flex items-center justify-between gap-3">
              <dt className="text-muted-foreground">{t.liff.summaryDateLabel}</dt>
              <dd className="text-right font-medium">{formatDateLong(thaiDayRange(done.date).start)}</dd>
            </div>
            <div className="flex items-center justify-between gap-3">
              <dt className="text-muted-foreground">{t.liff.summaryTimeLabel}</dt>
              <dd className="text-right font-medium">
                {done.time} {t.liff.timeUnitSuffix}
              </dd>
            </div>
          </dl>
        </div>
      </div>
    );
  }

  /* ---------- ขั้นที่ 4: ชำระเงิน ---------- */
  if (step === 4 && done) {
    return (
      <div className="space-y-5 py-4">
        {/* กดย้อนขั้นตอนได้ แต่ต้องยกเลิกใบเดิมก่อน — เตือนในกล่องยืนยันแล้ว */}
        <Stepper step={4} t={t} onJump={jumpBackFromPayment} />

        {/* ตัวนี้ถามสถานะเองทุก 8 วินาที จึงอัปเดตต่อเองทั้งตอนส่งสลิปและตอนร้านยืนยันเงิน */}
        <LiffPaymentBody orderId={done.orderId} />

        <Button
          variant="outline"
          className="h-12 w-full rounded-2xl text-destructive"
          disabled={isPending}
          onClick={() => setCancelOpen(true)}
        >
          <XCircle /> {t.liff.cancelBookingButton}
        </Button>

        <Dialog open={cancelOpen} onOpenChange={setCancelOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{t.liff.confirmCancelBookingTitle}</DialogTitle>
            </DialogHeader>
            <div className="space-y-1.5">
              <Label className="text-xs">{t.liff.cancelReasonLabel}</Label>
              <Textarea
                value={cancelReason}
                onChange={(e) => setCancelReason(e.target.value)}
                rows={3}
              />
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setCancelOpen(false)} disabled={isPending}>
                {t.common.cancel}
              </Button>
              <Button
                variant="destructive"
                disabled={isPending}
                onClick={() => cancelFromPayment(cancelReason.trim(), 1)}
              >
                {isPending ? <Loader2 className="animate-spin" /> : <XCircle />}
                {t.liff.cancelBookingButton}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    );
  }

  /* ---------- ขั้นที่ 3: ยืนยันแล้ว ---------- */
  if (step === 3 && done) {
    return (
      <div className="space-y-6 py-4">
        <Stepper step={3} t={t} />

        <div className="flex flex-col items-center gap-3 pt-4 text-center">
          <div
            className={cn(
              "flex h-16 w-16 items-center justify-center rounded-full",
              rejected ? "bg-destructive/15" : "bg-accent/40"
            )}
          >
            <span
              className={cn(
                "flex h-11 w-11 items-center justify-center rounded-full",
                rejected ? "bg-destructive" : "bg-primary"
              )}
            >
              {rejected ? (
                <XCircle className="h-5 w-5 text-primary-foreground" />
              ) : (
                <Check className="h-5 w-5 text-primary-foreground" strokeWidth={3} />
              )}
            </span>
          </div>
          <h1 className="text-xl font-bold tracking-tight">
            {rejected ? t.liff.queueRejectedTitle : t.liff.checkingQueueTitle}
          </h1>
          {rejected && (
            <p className="text-sm text-muted-foreground">{t.liff.queueRejectedHint}</p>
          )}
        </div>

        <div className="rounded-2xl border bg-card p-4">
          <div className="flex items-start gap-3">
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-accent/40">
              {(() => {
                const Icon = KIND_ICONS[done.kind];
                return <Icon className="h-5 w-5 text-primary" />;
              })()}
            </span>
            <div className="min-w-0 flex-1">
              <div className="font-semibold">{done.serviceLabel}</div>
              {done.petName && <div className="text-xs text-muted-foreground">{done.petName}</div>}
            </div>
            <div className="font-semibold text-primary">{formatBaht(done.total)}</div>
          </div>

          <div className="my-4 border-t border-dashed" />

          {/* รายการที่เลือกไว้ ตัวเล็กเหนือบรรทัดวันที่/เวลา — ลูกค้าจะได้เห็นว่าจองอะไรไปบ้าง
              ไม่ใช่แค่ชื่อประเภทบริการรวมๆ ด้านบน */}
          {done.items.length > 0 && (
            <div className="mb-3">
              <div className="text-[11px] text-muted-foreground">{t.liff.selectedItemsLabel}</div>
              <div className="mt-0.5 text-xs leading-relaxed">{done.items.join(" · ")}</div>
            </div>
          )}

          <dl className="space-y-2.5 text-sm">
            <div className="flex items-center justify-between gap-3">
              <dt className="text-muted-foreground">{t.liff.summaryDateLabel}</dt>
              <dd className="text-right font-medium">{formatDateLong(thaiDayRange(done.date).start)}</dd>
            </div>
            {done.checkOutDate && (
              <div className="flex items-center justify-between gap-3">
                <dt className="text-muted-foreground">{t.liff.summaryCheckOutLabel}</dt>
                <dd className="text-right font-medium">
                  {formatDateLong(thaiDayRange(done.checkOutDate).start)}
                </dd>
              </div>
            )}
            <div className="flex items-center justify-between gap-3">
              <dt className="text-muted-foreground">{t.liff.summaryTimeLabel}</dt>
              <dd className="text-right font-medium">
                {done.time} {t.liff.timeUnitSuffix}
              </dd>
            </div>
          </dl>
        </div>

        {rejected ? (
          // คิวไม่ผ่าน — พาไปเลือกวันเวลาใหม่ได้เลย โดยคงบริการกับสัตว์เลี้ยงที่เลือกไว้แล้ว
          <Button
            className="h-12 w-full rounded-2xl"
            onClick={() => {
              setRejected(false);
              setDone(null);
              setTime("");
              setStep(2);
            }}
          >
            {t.liff.bookAnotherButton}
          </Button>
        ) : (
          /* ยกเลิกเองได้เฉพาะตอนนี้ — พอพนักงานเช็คคิวผ่านแล้วจะมีเรื่องมัดจำกับคิวที่กันไว้ให้
             เข้ามาเกี่ยว ต้องคุยกับร้านเป็นรายกรณี ปุ่มนี้เลยหายไปเองเมื่อออเดอร์เดินหน้าต่อ */
          done.orderId && (
            <Button
              variant="outline"
              className="h-12 w-full rounded-2xl text-destructive"
              disabled={isPending}
              onClick={cancelBooking}
            >
              {isPending ? <Loader2 className="animate-spin" /> : <XCircle />}
              {t.liff.cancelBookingButton}
            </Button>
          )
        )}
      </div>
    );
  }

  /* ---------- ขั้นที่ 1: เลือกบริการ ---------- */
  if (step === 1) {
    return (
      <div className="space-y-5 pb-28">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/images/logo-light.png"
          alt={t.liff.bookPageTitle}
          className="mx-auto mt-4 h-20 w-auto sm:mt-0"
        />

        <div className="pt-2 sm:pt-0">
          <Stepper step={1} t={t} onJump={setStep} />
        </div>

        {pets.length > 1 && (
          <div className="space-y-2">
            <Label className="text-xs text-muted-foreground">{t.liff.petSectionTitle}</Label>
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
              <SelectTrigger className="h-12 w-full rounded-2xl bg-card">
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
        )}

        <div className="space-y-3">
          <p className="text-xs font-medium text-muted-foreground">{t.liff.chooseServiceTitle}</p>
          {(["BOARDING", "OTHER", "BATH"] as const).map((k) => {
            const Icon = KIND_ICONS[k];
            const active = kind === k;
            return (
              <button
                key={k}
                type="button"
                onClick={() => setKind(k)}
                className={cn(
                  "flex w-full items-center gap-3 rounded-2xl border-2 bg-card p-3 text-left transition-colors",
                  active ? "border-primary" : "border-transparent"
                )}
              >
                <span
                  className={cn(
                    "flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl transition-colors",
                    active ? "bg-primary text-primary-foreground" : "bg-accent/40 text-primary"
                  )}
                >
                  <Icon className="h-6 w-6" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block font-semibold">
                    {k === "BATH"
                      ? t.liff.bookingTypeBath
                      : k === "OTHER"
                        ? t.liff.bookingTypeOther
                        : t.liff.bookingTypeBoarding}
                  </span>
                  <span className="block text-xs text-muted-foreground">
                    {k === "BATH"
                      ? t.liff.kindBathSubtitle
                      : k === "OTHER"
                        ? t.liff.kindOtherSubtitle
                        : t.liff.kindBoardingSubtitle}
                  </span>
                </span>
              </button>
            );
          })}
        </div>

        <div className="fixed inset-x-3 bottom-3 z-10 mx-auto max-w-md sm:max-w-xl md:max-w-2xl">
          <Button className="h-14 w-full rounded-2xl text-base" onClick={() => setStep(2)}>
            {t.liff.nextStepButton}
          </Button>
        </div>
      </div>
    );
  }

  /* ---------- ขั้นที่ 2: เลือกวันและเวลา ---------- */
  return (
    <div className="space-y-4 pb-28">
      <div className="flex items-start gap-3">
        <button
          type="button"
          onClick={() => setStep(1)}
          aria-label={t.liff.backButton}
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border bg-card transition-colors hover:bg-muted"
        >
          <ArrowLeft className="h-4 w-4" />
        </button>
        <div className="min-w-0 flex-1">
          <Stepper step={2} t={t} onJump={setStep} />
        </div>
      </div>

      {/* บริการที่เลือกไว้ + ปุ่มย้อนไปเปลี่ยน */}
      <div className="flex items-center gap-3 rounded-2xl border bg-card p-3">
        <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-accent/40">
          {(() => {
            const Icon = KIND_ICONS[kind];
            return <Icon className="h-5 w-5 text-primary" />;
          })()}
        </span>
        <div className="min-w-0 flex-1">
          <div className="font-semibold">{kindLabel}</div>
          <div className="text-xs text-muted-foreground">{kindSubtitle}</div>
        </div>
        <button
          type="button"
          onClick={() => setStep(1)}
          className="shrink-0 rounded-full bg-accent/40 px-3.5 py-1.5 text-xs font-medium text-primary transition-colors hover:bg-accent/60"
        >
          {t.liff.changeSelectionButton}
        </button>
      </div>

      <MonthCalendar value={date} min={todayStr()} onChange={onDateChange} />

      {kind !== "BOARDING" ? (
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <Clock className="h-4 w-4 text-primary" />
            <span className="text-sm font-semibold">{t.liff.selectSlotLabel}</span>
            {time && (
              <span className="ml-auto rounded-full bg-accent/40 px-3 py-1 text-xs font-medium text-primary">
                ✓ {time} {t.liff.timeUnitSuffix}
              </span>
            )}
          </div>
          {loadingSlots ? (
            <div className="flex justify-center py-6">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          ) : slots.every((s) => !s.available) ? (
            <p className="py-4 text-center text-sm text-muted-foreground">{t.liff.noSlotsAvailable}</p>
          ) : (
            <TimeSlotGroups slots={slots} value={time} onChange={setTime} t={t} />
          )}
        </div>
      ) : (
        <div className="space-y-4 rounded-2xl border bg-card p-4">
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">{t.liff.selectRoomLabel}</Label>
            <Select
              value={roomId}
              onValueChange={(v) => onRoomChange(v ?? "")}
              items={rooms.map((r) => ({
                value: r.id,
                label: `${r.category.name} · ${r.name} · ${formatBaht(r.pricePerNight)}`,
              }))}
            >
              <SelectTrigger className="h-11 w-full rounded-xl">
                <SelectValue placeholder={t.liff.selectRoomLabel} />
              </SelectTrigger>
              <SelectContent>
                {roomsByCategory.map(({ categoryName, rooms: roomsInCat }) => (
                  <SelectGroup key={categoryName}>
                    <SelectLabel>{categoryName}</SelectLabel>
                    {roomsInCat.map((r) => (
                      <SelectItem key={r.id} value={r.id}>
                        {r.name} · {formatBaht(r.pricePerNight)}/
                        {r.category.billingUnit === "PER_NIGHT"
                          ? t.orders.form.perNightUnit
                          : t.orders.form.perVisitUnit}
                      </SelectItem>
                    ))}
                  </SelectGroup>
                ))}
              </SelectContent>
            </Select>
          </div>

          {selectedRoom && (
            <>
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">{t.orders.form.checkInLabel}</Label>
                <TimeSelect value={checkInTime} onChange={setCheckInTime} minHour={9} maxHour={20} />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">{t.orders.form.checkOutLabel}</Label>
                <div className="space-y-2">
                  <DateSelect value={checkOutDate} min={checkInDate} onChange={setCheckOutDate} />
                  <TimeSelect value={checkOutTime} onChange={setCheckOutTime} minHour={9} maxHour={20} />
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
                <Label className="text-xs text-muted-foreground">{t.liff.nannyLabel}</Label>
                <div className="grid grid-cols-3 gap-2">
                  {(["NONE", "REGULAR", "VIP"] as const).map((opt) => (
                    <button
                      key={opt}
                      type="button"
                      onClick={() => setNannyType(opt)}
                      className={cn(
                        "rounded-xl border p-2.5 text-center text-xs transition-colors",
                        nannyType === opt ? "border-primary bg-accent/40 font-medium" : "hover:bg-muted"
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
        </div>
      )}

      {/* บริการเสริม */}
      {(pickableServices.length > 0 || defaultOnServices.length > 0) && (
        <div className="space-y-3 rounded-2xl border bg-card p-4">
          <p className="text-sm font-semibold">{t.liff.servicesSectionTitle}</p>
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
                      "flex items-center justify-between rounded-xl border p-3 text-left text-sm transition-colors",
                      active ? "border-primary bg-accent/40" : "hover:bg-muted"
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
                        "flex items-center justify-between rounded-xl border p-3 text-left text-sm transition-colors",
                        active ? "border-primary bg-accent/40" : "hover:bg-muted"
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
        </div>
      )}

      <div className="space-y-1.5">
        <Label className="text-xs text-muted-foreground">{t.orders.form.noteLabel}</Label>
        <Textarea value={note} onChange={(e) => setNote(e.target.value)} rows={2} className="rounded-xl bg-card" />
      </div>

      <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <DialogContent className="rounded-3xl sm:max-w-sm">
          <DialogHeader className="items-center text-center">
            <span className="mb-1 flex h-14 w-14 items-center justify-center rounded-full bg-accent/40">
              <CalendarCheck className="h-7 w-7 text-primary" />
            </span>
            <DialogTitle className="text-center text-lg">{t.liff.confirmBookingTitle}</DialogTitle>
          </DialogHeader>

          <div className="space-y-1 rounded-2xl bg-muted/50 p-4 text-center">
            <p className="text-sm text-muted-foreground">{t.liff.confirmBookingQuestion}</p>
            <p className="text-base font-semibold">
              {formatDateLong(thaiDayRange(kind === "BOARDING" ? checkInDate : date).start)}
            </p>
            <p className="text-sm font-medium text-primary">
              {kind === "BOARDING" ? checkInTime : time} {t.liff.timeUnitSuffix}
            </p>
          </div>

          <DialogFooter className="gap-2 sm:flex-row">
            <Button
              variant="outline"
              className="h-12 w-full rounded-2xl text-base sm:flex-1"
              onClick={() => setConfirmOpen(false)}
              disabled={isPending}
            >
              {t.common.cancel}
            </Button>
            <Button
              className="h-12 w-full rounded-2xl text-base sm:flex-1"
              onClick={submit}
              disabled={isPending}
            >
              {isPending ? <Loader2 className="animate-spin" /> : null}
              {t.liff.confirmBookingButton}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* สรุปยอด + ปุ่มยืนยัน แปะด้านล่างจอเสมอ */}
      <div className="fixed inset-x-3 bottom-3 z-10 mx-auto max-w-md rounded-2xl border bg-card p-3 shadow-[0_-2px_12px_rgba(0,0,0,0.06)] sm:max-w-xl md:max-w-2xl">
        <div className="mb-2 flex items-center justify-between px-1 text-sm">
          <span className="text-muted-foreground">
            {kind === "BATH" && depositAmount > 0 ? t.orders.form.depositLabel : t.orders.form.grandTotal}
          </span>
          <span className="text-lg font-bold text-primary">
            {formatBaht(kind === "BATH" && depositAmount > 0 ? depositAmount : total)}
          </span>
        </div>
        <Button
          className="h-14 w-full rounded-2xl text-base"
          onClick={() => setConfirmOpen(true)}
          disabled={isPending || !canSubmit}
        >
          {isPending ? <Loader2 className="animate-spin" /> : null}
          {kind !== "BOARDING" && time ? t.liff.confirmWithTime(time) : t.liff.confirmBookingButton}
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
