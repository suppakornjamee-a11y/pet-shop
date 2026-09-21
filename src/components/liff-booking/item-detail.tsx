"use client";

import { useEffect, useMemo, useState } from "react";
import { Check, Loader2, Sparkles, Video, Wallet } from "lucide-react";
import { getOpenSlots, checkRoomAvailability } from "@/app/actions/liff";
import type { FleaTickProductInfo } from "@/lib/flea-tick";
import { formatBaht, formatDateLong } from "@/lib/format";
import { addDaysThai, thaiDayRange } from "@/lib/slots";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { bathGroups, estimateDraft, type ItemDraft } from "./cart";
import { FleaTickSection } from "./flea-section";
import { ImagePicker } from "./image-picker";
import {
  CCTV_ROOM_RATE,
  MonthCalendar,
  NANNY_REGULAR_RATE,
  NANNY_VIP_RATE,
  Section,
  TimeSlotGroups,
  todayStr,
  type CtxPet,
  type Room,
  type Service,
  type SlotOption,
  type T,
} from "./shared";

/** แถวตัวเลือกบริการ — radio = เลือกได้อย่างเดียวในกลุ่ม, check = ติ๊กได้หลายรายการ (วงกลม/ช่องติ๊กบอกสถานะที่เลือกชัดเจน) */
function OptionRow({
  active,
  label,
  price,
  mode,
  onClick,
}: {
  active: boolean;
  label: string;
  price?: number;
  mode: "radio" | "check";
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      role={mode === "radio" ? "radio" : "checkbox"}
      aria-checked={active}
      onClick={onClick}
      className={cn(
        "flex items-center gap-3 rounded-2xl border p-3.5 text-left text-sm transition-colors",
        active ? "border-primary bg-primary/5" : "bg-card hover:bg-muted/60"
      )}
    >
      <span
        aria-hidden
        className={cn(
          "flex h-5 w-5 shrink-0 items-center justify-center border-2 transition-colors",
          mode === "radio" ? "rounded-full" : "rounded-md",
          active ? "border-primary bg-primary text-primary-foreground" : "border-muted-foreground/30"
        )}
      >
        {active &&
          (mode === "radio" ? (
            <span className="h-1.5 w-1.5 rounded-full bg-primary-foreground" />
          ) : (
            <Check className="h-3.5 w-3.5" strokeWidth={3} />
          ))}
      </span>
      <span className={cn("min-w-0 flex-1", active ? "font-semibold" : "font-medium")}>{label}</span>
      {price !== undefined && (
        <span className={cn("shrink-0 font-bold tabular-nums", active && "text-primary")}>
          {formatBaht(price)}
        </span>
      )}
    </button>
  );
}

/* ---------- วันเวลา ---------- */

export function SlotPicker({
  draft,
  set,
  t,
}: {
  draft: ItemDraft;
  set: (patch: Partial<ItemDraft>) => void;
  t: T;
}) {
  const [slots, setSlots] = useState<SlotOption[]>([]);
  const [loading, setLoading] = useState(true);
  const queueType = draft.kind === "OTHER" ? "OTHER" : "BATH";

  useEffect(() => {
    let active = true;
    const id = setTimeout(() => {
      setLoading(true);
      getOpenSlots(draft.date, queueType).then((result) => {
        if (!active) return;
        setSlots(result);
        setLoading(false);
      });
    }, 0);
    return () => {
      active = false;
      clearTimeout(id);
    };
  }, [draft.date, queueType]);

  return (
    <Section>
      <MonthCalendar title={t.liffBook.dateTimeTitle} value={draft.date} min={todayStr()} onChange={(date) => set({ date, time: "" })} />
      <div className="space-y-3">
        <div className="flex items-center gap-2">
          <span className="text-sm font-bold">{t.liffBook.slotsTitle}</span>
          {draft.time && (
            <span className="ml-auto rounded-full bg-accent/40 px-3 py-1 text-xs font-medium text-primary">
              ✓ {draft.time} {t.liff.timeUnitSuffix}
            </span>
          )}
        </div>
        {loading ? (
          <div className="flex justify-center py-6">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        ) : slots.every((s) => !s.available) ? (
          <p className="py-4 text-center text-sm text-muted-foreground">{t.liff.noSlotsAvailable}</p>
        ) : (
          // เวลาที่เลือกไว้เดิม (แก้รายการในตะกร้า) ยังกดค้างได้แม้คิวจะเต็มจากรายการของตัวเอง
          <TimeSlotGroups
            slots={slots.map((s) => (s.time === draft.time ? { ...s, available: true } : s))}
            value={draft.time}
            onChange={(time) => set({ time })}
            t={t}
          />
        )}
      </div>
    </Section>
  );
}

function RoomPicker({
  draft,
  set,
  rooms,
  t,
}: {
  draft: ItemDraft;
  set: (patch: Partial<ItemDraft>) => void;
  rooms: Room[];
  t: T;
}) {
  const room = rooms.find((r) => r.id === draft.roomId) ?? null;
  const perVisit = room?.category.billingUnit === "PER_VISIT";
  const { nights } = estimateDraft(draft, [], rooms);
  const [available, setAvailable] = useState<boolean | null>(null);
  const [checking, setChecking] = useState(false);

  const byCategory = useMemo(() => {
    const map = new Map<string, { name: string; rooms: Room[] }>();
    for (const r of rooms) {
      const entry = map.get(r.categoryId) ?? { name: r.category.name, rooms: [] };
      entry.rooms.push(r);
      map.set(r.categoryId, entry);
    }
    return [...map.values()];
  }, [rooms]);

  useEffect(() => {
    const skip = !draft.roomId;
    const id = setTimeout(
      () => {
        if (skip) {
          setAvailable(null);
          return;
        }
        setChecking(true);
        setAvailable(null);
        checkRoomAvailability(draft.roomId, draft.date, draft.checkInTime, draft.checkOutDate, draft.checkOutTime)
          .then(setAvailable)
          .finally(() => setChecking(false));
      },
      skip ? 0 : 300
    );
    return () => clearTimeout(id);
  }, [draft.roomId, draft.date, draft.checkInTime, draft.checkOutDate, draft.checkOutTime]);

  function onRoom(id: string) {
    const r = rooms.find((x) => x.id === id);
    if (r?.category.billingUnit === "PER_VISIT") {
      set({ roomId: id, checkOutDate: draft.date, checkInTime: "13:00", checkOutTime: "18:00" });
    } else {
      set({ roomId: id, checkOutDate: draft.checkOutDate <= draft.date ? addDaysThai(draft.date, 1) : draft.checkOutDate });
    }
  }

  function onCheckIn(v: string) {
    if (perVisit) set({ date: v, checkOutDate: v });
    else set({ date: v, checkOutDate: draft.checkOutDate <= v ? addDaysThai(v, 1) : draft.checkOutDate });
  }

  return (
    <Section>
      <div className="space-y-1.5">
        <Label className="text-xs text-muted-foreground">{t.liff.selectRoomLabel}</Label>
        <Select
          value={draft.roomId}
          onValueChange={(v) => onRoom(v ?? "")}
          items={rooms.map((r) => ({ value: r.id, label: `${r.category.name} · ${r.name} · ${formatBaht(r.pricePerNight)}` }))}
        >
          <SelectTrigger className="h-11 w-full rounded-xl">
            <SelectValue placeholder={t.liff.selectRoomLabel} />
          </SelectTrigger>
          <SelectContent>
            {byCategory.map((c) => (
              <SelectGroup key={c.name}>
                <SelectLabel>{c.name}</SelectLabel>
                {c.rooms.map((r) => (
                  <SelectItem key={r.id} value={r.id}>
                    {r.name} · {formatBaht(r.pricePerNight)}/
                    {r.category.billingUnit === "PER_NIGHT" ? t.orders.form.perNightUnit : t.orders.form.perVisitUnit}
                  </SelectItem>
                ))}
              </SelectGroup>
            ))}
          </SelectContent>
        </Select>
      </div>

      {room && (
        <>
          <div className="flex flex-wrap gap-2 text-xs">
            <Badge variant="secondary">{t.labels.billingUnit[room.category.billingUnit]}</Badge>
            {room.hasAir && <Badge variant="secondary">{t.settings.rooms.hasAir}</Badge>}
            {room.hasFan && <Badge variant="secondary">{t.settings.rooms.hasFan}</Badge>}
            {room.equipment
              ?.split(",")
              .filter(Boolean)
              .map((e) => (
                <Badge key={e} variant="outline">
                  {e.trim()}
                </Badge>
              ))}
          </div>

          <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">{t.orders.form.checkInLabel}</Label>
              <div className="grid grid-cols-[1fr_auto] gap-2">
                <Input type="date" className="min-w-0" value={draft.date} min={todayStr()} onChange={(e) => onCheckIn(e.target.value)} />
                <Input type="time" className="w-28" value={draft.checkInTime} onChange={(e) => set({ checkInTime: e.target.value })} />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">{t.orders.form.checkOutLabel}</Label>
              <div className="grid grid-cols-[1fr_auto] gap-2">
                <Input
                  type="date"
                  className="min-w-0"
                  value={draft.checkOutDate}
                  min={draft.date}
                  disabled={perVisit}
                  onChange={(e) => set({ checkOutDate: e.target.value })}
                />
                <Input type="time" className="w-28" value={draft.checkOutTime} onChange={(e) => set({ checkOutTime: e.target.value })} />
              </div>
            </div>
          </div>
          {nights > 0 && <p className="text-xs text-muted-foreground">{t.orders.form.nightsCount(nights)}</p>}
          {checking ? (
            <p className="text-xs text-muted-foreground">{t.liff.checkingAvailability}</p>
          ) : available === false ? (
            <p className="text-xs font-medium text-destructive">{t.liff.roomUnavailable}</p>
          ) : null}

          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">{t.liff.nannyLabel}</Label>
            <div className="grid grid-cols-3 gap-2">
              {(["NONE", "REGULAR", "VIP"] as const).map((opt) => (
                <button
                  key={opt}
                  type="button"
                  onClick={() => set({ nannyType: opt })}
                  className={cn(
                    "rounded-xl border p-2.5 text-center text-xs transition-colors",
                    draft.nannyType === opt ? "border-primary bg-accent/40 font-medium" : "hover:bg-muted"
                  )}
                >
                  <div>
                    {opt === "NONE" ? t.orders.form.nannyNone : opt === "REGULAR" ? t.orders.form.nannyRegular : t.orders.form.nannyVip}
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
              checked={draft.cctvRequested}
              onChange={(e) => set({ cctvRequested: e.target.checked })}
              className="h-4 w-4 accent-primary"
            />
            <Video className="h-4 w-4 text-muted-foreground" />
            {t.liff.cctvLabel} ({formatBaht(CCTV_ROOM_RATE)})
          </label>
        </>
      )}
    </Section>
  );
}

/* ---------- หน้ารายละเอียดรายการ ---------- */

export function ItemDetail({
  draft,
  onChange,
  pet,
  catalog,
  invalidId,
  services,
  rooms,
  t,
}: {
  draft: ItemDraft;
  onChange: (d: ItemDraft) => void;
  pet: CtxPet;
  catalog: FleaTickProductInfo[];
  /** ช่องแรกที่ยังกรอกไม่ครบตอนกดตรวจสอบรายการ — ขึ้นขอบแดง */
  invalidId?: string | null;
  /** บริการของประเภทนี้ที่กรองชนิดสัตว์แล้ว */
  services: Service[];
  rooms: Room[];
  t: T;
}) {
  const set = (patch: Partial<ItemDraft>) => onChange({ ...draft, ...patch });
  const [addonsOpen, setAddonsOpen] = useState(() => {
    const addonIds = new Set(bathGroups(services).addons.map((s) => s.id));
    return draft.serviceIds.some((id) => addonIds.has(id));
  });
  const groups = bathGroups(services);
  const has = (id: string) => draft.serviceIds.includes(id);

  // ติ๊กบริการฟรีให้ครั้งเดียวตอนเริ่มรายการใหม่ (ลูกค้าถอนออกเองได้) — state อยู่ที่หน้าแม่ จึงต้องทำใน effect
  useEffect(() => {
    if (draft.defaultsApplied || services.length === 0) return;
    onChange({
      ...draft,
      defaultsApplied: true,
      serviceIds: [...new Set([...draft.serviceIds, ...services.filter((s) => s.defaultOn).map((s) => s.id)])],
    });
  }, [draft, services, onChange]);

  function toggle(id: string) {
    set({ serviceIds: has(id) ? draft.serviceIds.filter((x) => x !== id) : [...draft.serviceIds, id] });
  }
  /** เลือกได้ทีละรายการในกลุ่ม (อาบน้ำหลัก / ตัดขน) — id null = ไม่เลือกในกลุ่มนี้ */
  function pickOne(group: Service[], id: string | null) {
    const groupIds = new Set(group.map((s) => s.id));
    const rest = draft.serviceIds.filter((x) => !groupIds.has(x));
    set({ serviceIds: id ? [...rest, id] : rest });
  }

  const groomChosen = groups.groom.some((s) => has(s.id));
  const { estimate } = estimateDraft(draft, services, rooms);
  const pickable = services.filter((s) => !s.defaultOn).sort((a, b) => a.price - b.price);

  return (
    <div className="space-y-4">
      {draft.kind === "BOARDING" ? <RoomPicker draft={draft} set={set} rooms={rooms} t={t} /> : <SlotPicker draft={draft} set={set} t={t} />}

      {draft.kind === "BATH" && (
        <>
          <FleaTickSection draft={draft} set={set} pet={pet} catalog={catalog} invalidId={invalidId} t={t} />

          <Section title={t.liffBook.bathType}>
            <div className="grid gap-2">
              {groups.main.map((s) => (
                <OptionRow
                  key={s.id}
                  mode="radio"
                  active={has(s.id)}
                  label={s.name}
                  price={s.price}
                  onClick={() => pickOne(groups.main, s.id)}
                />
              ))}
            </div>
          </Section>

          {groups.groom.length > 0 && (
            <Section title={t.liffBook.groomType}>
              <div className="grid gap-2">
                <OptionRow mode="radio" active={!groomChosen} label={t.liffBook.noGroom} onClick={() => pickOne(groups.groom, null)} />
                {groups.groom.map((s) => (
                  <OptionRow
                    key={s.id}
                    mode="radio"
                    active={has(s.id)}
                    label={s.name}
                    price={s.price}
                    onClick={() => pickOne(groups.groom, s.id)}
                  />
                ))}
              </div>
              {groomChosen && (
                <div className="space-y-3 border-t pt-3">
                  <div className="space-y-1.5">
                    <Label htmlFor="style-note" className="font-semibold">
                      {t.liffBook.styleLabel}
                    </Label>
                    <Textarea
                      id="style-note"
                      rows={2}
                      className="rounded-2xl border-primary/15 bg-primary/5"
                      value={draft.styleNote}
                      onChange={(e) => set({ styleNote: e.target.value })}
                    />
                  </div>
                  <ImagePicker
                    variant="button"
                    label={t.liffBook.styleImages}
                    buttonLabel={t.liffBook.styleImagesButton}
                    images={draft.styleImages}
                    onChange={(styleImages) => set({ styleImages })}
                    max={3}
                    t={t}
                  />
                </div>
              )}
            </Section>
          )}

          {groups.addons.length > 0 && (
            <div className="space-y-3">
              <Button type="button" variant="outline" className="w-full rounded-2xl" onClick={() => setAddonsOpen((v) => !v)}>
                {addonsOpen ? t.liffBook.hideAddons : t.liffBook.showAddons}
              </Button>
              {addonsOpen && (
                <Section>
                  <div className="grid gap-2">
                    {groups.addons.map((s) => (
                      <OptionRow
                        key={s.id}
                        mode="check"
                        active={has(s.id)}
                        label={s.name}
                        price={s.price}
                        onClick={() => toggle(s.id)}
                      />
                    ))}
                  </div>
                </Section>
              )}
            </div>
          )}
        </>
      )}

      {draft.kind !== "BATH" && pickable.length > 0 && (
        <Section title={draft.kind === "OTHER" ? t.liffBook.services : t.liff.servicesSectionTitle} icon={Sparkles}>
          <div className="grid gap-2">
            {pickable.map((s) => (
              <OptionRow key={s.id} mode="check" active={has(s.id)} label={s.name} price={s.price} onClick={() => toggle(s.id)} />
            ))}
          </div>
        </Section>
      )}

      {groups.free.length > 0 && (
        <Section title={t.liff.defaultServicesTitle} icon={Sparkles}>
          <div className="grid gap-2">
            {groups.free.map((s) => (
              <OptionRow key={s.id} mode="check" active={has(s.id)} label={s.name} price={s.price} onClick={() => toggle(s.id)} />
            ))}
          </div>
        </Section>
      )}

      {draft.kind !== "BATH" && (
        <div className="space-y-1.5">
          <Label className="text-xs text-muted-foreground">{t.orders.form.noteLabel}</Label>
          <Textarea value={draft.note} onChange={(e) => set({ note: e.target.value })} rows={2} className="rounded-xl bg-card" />
        </div>
      )}

      {draft.kind === "BATH" && (
        <Section tone="accent">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <span
                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-primary-foreground shadow-sm ring-4 ring-primary/10"
                style={{
                  backgroundColor: "var(--primary)",
                  backgroundImage: "linear-gradient(135deg, var(--primary), color-mix(in oklab, var(--primary) 55%, white))",
                }}
              >
                <Wallet className="h-5 w-5" />
              </span>
              <span className="text-sm font-semibold">{t.liffBook.estimate}</span>
            </div>
            <span className="text-2xl font-bold tabular-nums text-primary">{formatBaht(estimate)}</span>
          </div>
          <p className="rounded-xl bg-card px-3 py-2 text-sm font-medium">{t.liffBook.bathDeposit}</p>
          <div className="space-y-1.5 text-xs leading-relaxed text-muted-foreground">
            <p>{t.liffBook.priceNote}</p>
            <p>{t.liffBook.depositNote}</p>
          </div>
        </Section>
      )}
    </div>
  );
}

/** ใช้ตัดสินว่ากดปุ่ม "ตรวจสอบรายการ" ได้หรือยัง */
export function draftReady(draft: ItemDraft, services: Service[], rooms: Room[]): boolean {
  if (draft.kind === "BOARDING") return !!draft.roomId && rooms.some((r) => r.id === draft.roomId);
  if (!draft.time) return false;
  if (draft.kind === "BATH") return bathGroups(services).main.some((s) => draft.serviceIds.includes(s.id));
  return draft.serviceIds.some((id) => services.some((s) => s.id === id && !s.defaultOn));
}

export function whenLabel(draft: ItemDraft, t: T): string[] {
  const day = (d: string) => formatDateLong(thaiDayRange(d).start);
  if (draft.kind === "BOARDING") {
    return [t.liff.confirmCheckInLine(day(draft.date), draft.checkInTime), t.liff.confirmCheckOutLine(day(draft.checkOutDate), draft.checkOutTime)];
  }
  return [`${day(draft.date)} ${draft.time} ${t.liff.timeUnitSuffix}`];
}
