"use client";

import { Fragment, useState } from "react";
import { ChevronLeft, ChevronRight, Sunrise, Sun, Sunset } from "lucide-react";
import { toThaiDateStr } from "@/lib/slots";
import { cn } from "@/lib/utils";
import { useI18n } from "@/components/i18n-provider";

/* ---------- ชนิดข้อมูลที่หน้าจองใช้ร่วมกัน ---------- */

export type Kind = "BATH" | "OTHER" | "BOARDING";
export type Species = "DOG" | "CAT";
export type T = ReturnType<typeof useI18n>["t"];

export type Service = {
  id: string;
  name: string;
  category: string;
  group: string | null;
  speciesScope: Species | null;
  defaultOn: boolean;
  price: number;
};

export type Room = {
  id: string;
  categoryId: string;
  name: string;
  pricePerNight: number;
  hasAir: boolean;
  hasFan: boolean;
  equipment: string | null;
  category: { id: string; name: string; billingUnit: "PER_NIGHT" | "PER_VISIT" };
};

export type SlotOption = { time: string; available: boolean };

export const todayStr = () => toThaiDateStr(new Date());
export const NANNY_REGULAR_RATE = 300;
export const NANNY_VIP_RATE = 400;
export const CCTV_ROOM_RATE = 100;
export const BATH_DEPOSIT_AMOUNT = 300;

/* ---------- ปฏิทินรายเดือน ---------- */

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

// เรียงวันแบบเริ่มวันจันทร์ (ไม่ใช่อาทิตย์เหมือนปฏิทินฝั่งพนักงาน) ตามแบบที่ออกแบบไว้ให้ลูกค้า
const WEEKDAY_LABELS = ["จ", "อ", "พ", "พฤ", "ศ", "ส", "อา"];

/** ช่องว่างนำหน้าวันที่ 1 ของเดือน เมื่อสัปดาห์เริ่มที่วันจันทร์ (getDay(): 0=อาทิตย์) */
function leadingBlanks(year: number, month: number): number {
  return (new Date(year, month - 1, 1).getDay() + 6) % 7;
}

export function MonthCalendar({
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

      <div className="grid grid-cols-7 gap-1 text-center text-[0.6875rem] text-muted-foreground">
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
              {isToday && !isSelected && <span className="absolute bottom-1.5 h-1 w-1 rounded-full bg-primary" />}
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

/** ป้ายช่วงเวลาจริงของกลุ่ม (เช่น "10:00 – 11:30") คำนวณจากช่วงที่มีอยู่จริง ไม่ฮาร์ดโค้ด */
function groupRangeLabel(slots: SlotOption[]): string {
  if (slots.length === 0) return "";
  return `${slots[0].time} – ${slots[slots.length - 1].time}`;
}

export function TimeSlotGroups({
  slots,
  value,
  onChange,
  t,
}: {
  slots: SlotOption[];
  value: string;
  onChange: (time: string) => void;
  t: T;
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
        .map((g) => (
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
                    {s.available && !isSelected && <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-primary" />}
                    {s.time}
                  </button>
                );
              })}
            </div>
          </div>
        ))}
    </div>
  );
}

/* ---------- แถบขั้นตอน 4 ขั้น ---------- */

/** 1 จองคิว (เลือกบริการ + ข้อมูลสัตว์ + วันเวลา รวมไว้ขั้นเดียว) · 2 รอตรวจสอบ · 3 ชำระเงิน · 4 รอดำเนินการ */
export type Step = 1 | 2 | 3 | 4;

const STEP_ICONS = [
  "/images/icons/step-queue.png",
  "/images/icons/step-checking.png",
  "/images/icons/step-pay.png",
  "/images/icons/step-progress.png",
];

/** ไอคอนขั้นตอนเป็น PNG ลายเส้นสีดำล้วน — ระบายสีตาม currentColor ด้วย mask ทำให้เปลี่ยนสีตามสถานะได้ด้วยไฟล์เดียว */
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

export function Stepper({ step, t }: { step: Step; t: T }) {
  const labels = [t.liff.stepBookQueue, t.liff.stepAwaitReview, t.liff.stepPayment, t.liff.stepInProgress];
  return (
    <div className="flex items-start">
      {labels.map((label, i) => {
        const n = (i + 1) as Step;
        const active = n <= step;
        return (
          <Fragment key={label}>
            <div className="flex w-16 shrink-0 flex-col items-center gap-1 py-1">
              <StepIcon
                src={STEP_ICONS[i]}
                className={cn("h-8 w-8 transition-colors", active ? "text-primary" : "text-muted-foreground/35")}
              />
              <span
                className={cn(
                  "text-center text-[0.625rem] leading-tight",
                  active ? "font-medium text-primary" : "text-muted-foreground"
                )}
              >
                {label}
              </span>
            </div>
            {i < labels.length - 1 && (
              <div className={cn("mt-4 flex-1 border-t-2 border-dashed", n < step ? "border-primary" : "border-border")} />
            )}
          </Fragment>
        );
      })}
    </div>
  );
}
