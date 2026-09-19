"use client";

import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { toast } from "sonner";
import { Clock, ImagePlus, Loader2, Video, X } from "lucide-react";
import { getOpenSlots, checkRoomAvailability, liffUpdatePetFleaTick } from "@/app/actions/liff";
import { computeFleaTickStatus, type FleaTickProductInfo } from "@/lib/flea-tick";
import { compressImageToDataUrl } from "@/lib/file";
import { formatBaht, formatDateLong } from "@/lib/format";
import { addDaysThai, thaiDayRange } from "@/lib/slots";
import { cn } from "@/lib/utils";
import { handleLiffAuthExpiry } from "@/components/liff-provider";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { MedicineNameField } from "./pet-quick-form";
import { bathGroups, estimateDraft, type ItemDraft } from "./cart";
import {
  CCTV_ROOM_RATE,
  MonthCalendar,
  NANNY_REGULAR_RATE,
  NANNY_VIP_RATE,
  TimeSlotGroups,
  todayStr,
  type Room,
  type Service,
  type SlotOption,
  type Species,
  type T,
} from "./shared";

/** ข้อมูลสัตว์เลี้ยงจาก liffGetBookingContext */
export type CtxPet = {
  id: string;
  name: string;
  species: Species;
  breed: string | null;
  birthDate: string;
  weightKg: number | null;
  allergies: string | null;
  groomingCautions: string | null;
  hasChronicDisease: boolean | null;
  chronicDiseaseNote: string | null;
  fleaTickMedicine: string | null;
  fleaTickProductId: string | null;
  lastFleaTickAt: string;
};

const STYLE_IMAGE_LIMIT = 3;

function OptionRow({
  active,
  label,
  price,
  onClick,
}: {
  active: boolean;
  label: string;
  price?: number;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "flex items-center justify-between gap-3 rounded-xl border p-3 text-left text-sm transition-colors",
        active ? "border-primary bg-accent/40" : "bg-card hover:bg-muted"
      )}
    >
      <span className={cn(active && "font-medium")}>{label}</span>
      {price !== undefined && <span className="shrink-0 text-muted-foreground">{formatBaht(price)}</span>}
    </button>
  );
}

function Section({ title, children }: { title?: string; children: React.ReactNode }) {
  return (
    <div className="space-y-3 rounded-2xl border bg-card p-4">
      {title && <p className="text-sm font-semibold">{title}</p>}
      {children}
    </div>
  );
}

/* ---------- ยาเห็บหมัด เทียบกับวันเข้าใช้บริการ ---------- */

function FleaCheck({
  pet,
  serviceDate,
  catalog,
  idToken,
  onSaved,
  t,
}: {
  pet: CtxPet;
  serviceDate: string;
  catalog: FleaTickProductInfo[];
  idToken: string;
  onSaved: () => Promise<void>;
  t: T;
}) {
  const product = catalog.find((p) => p.id === pet.fleaTickProductId) ?? null;
  const status = computeFleaTickStatus({
    givenAt: pet.lastFleaTickAt || null,
    product,
    petSpecies: pet.species,
    serviceDate,
  });
  const [medicine, setMedicine] = useState({ name: pet.fleaTickMedicine ?? "", productId: pet.fleaTickProductId });
  const [givenAt, setGivenAt] = useState("");
  const [isPending, startTransition] = useTransition();

  function save() {
    startTransition(async () => {
      const res = await liffUpdatePetFleaTick(idToken, pet.id, {
        fleaTickMedicine: medicine.name,
        fleaTickProductId: medicine.productId,
        lastFleaTickDate: givenAt || undefined,
      });
      if (!res.ok) {
        handleLiffAuthExpiry(res);
        toast.error(res.error);
        return;
      }
      toast.success(t.liffBook.fleaSaved);
      setGivenAt("");
      await onSaved();
    });
  }

  const dueLabel = status.nextDueDate ? t.fleaTick.nextDue(formatDateLong(thaiDayRange(status.nextDueDate).start)) : null;

  return (
    <Section title={t.liffBook.fleaTitle}>
      {status.kind === "INCOMPLETE" ? (
        <p className="text-sm text-muted-foreground">{t.liffBook.fleaPendingNotice}</p>
      ) : (
        <p className={cn("text-sm", status.kind === "DUE_BEFORE_SERVICE" ? "font-medium text-destructive" : "")}>
          {dueLabel}
        </p>
      )}
      {status.kind === "DUE_BEFORE_SERVICE" && (
        <div className="space-y-3 border-t pt-3">
          <p className="text-sm font-medium">{t.liffBook.fleaUpdate}</p>
          <div className="space-y-1.5">
            <Label>{t.liffBook.fleaMedicine}</Label>
            <MedicineNameField
              value={medicine.name}
              productId={medicine.productId}
              species={pet.species}
              catalog={catalog}
              onChange={(patch) =>
                setMedicine((m) => ({
                  name: patch.fleaTickMedicine ?? m.name,
                  productId: patch.fleaTickProductId !== undefined ? patch.fleaTickProductId : m.productId,
                }))
              }
              t={t}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="flea-new-date">{t.liffBook.fleaDate}</Label>
            <Input
              id="flea-new-date"
              type="date"
              lang="en-GB"
              max={todayStr()}
              className="h-11 rounded-xl bg-card"
              value={givenAt}
              onChange={(e) => setGivenAt(e.target.value)}
            />
          </div>
          <Button type="button" variant="outline" className="w-full rounded-xl" disabled={isPending || !givenAt} onClick={save}>
            {isPending && <Loader2 className="animate-spin" />}
            {t.liffBook.fleaSave}
          </Button>
        </div>
      )}
    </Section>
  );
}

/* ---------- ภาพตัวอย่างทรงขน ---------- */

function StyleImages({ images, onChange, t }: { images: string[]; onChange: (v: string[]) => void; t: T }) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);

  async function add(files: FileList | null) {
    if (!files) return;
    setBusy(true);
    try {
      const next = [...images];
      for (const f of Array.from(files).slice(0, STYLE_IMAGE_LIMIT - images.length)) {
        // ย่อให้เล็กกว่าสลิป — ใช้ดูทรงเท่านั้น และส่งไปพร้อมคำขอจองหลายรายการในครั้งเดียว
        next.push(await compressImageToDataUrl(f, { maxSide: 1000, quality: 0.72 }));
      }
      onChange(next);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : t.liff.errorTitle);
    } finally {
      setBusy(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  return (
    <div className="space-y-1.5">
      <Label>{t.liffBook.styleImages}</Label>
      <div className="flex flex-wrap gap-2">
        {images.map((src, i) => (
          <div key={i} className="relative h-20 w-20 overflow-hidden rounded-xl border">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={src} alt="" className="h-full w-full object-cover" />
            <button
              type="button"
              aria-label={t.liffBook.remove}
              onClick={() => onChange(images.filter((_, j) => j !== i))}
              className="absolute right-1 top-1 flex h-6 w-6 items-center justify-center rounded-full bg-black/60 text-white"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        ))}
        {images.length < STYLE_IMAGE_LIMIT && (
          <button
            type="button"
            disabled={busy}
            onClick={() => inputRef.current?.click()}
            className="flex h-20 w-20 items-center justify-center rounded-xl border border-dashed text-muted-foreground transition-colors hover:bg-muted"
          >
            {busy ? <Loader2 className="h-5 w-5 animate-spin" /> : <ImagePlus className="h-5 w-5" />}
          </button>
        )}
      </div>
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        multiple
        className="hidden"
        onChange={(e) => add(e.target.files)}
      />
    </div>
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
    <>
      <MonthCalendar value={draft.date} min={todayStr()} onChange={(date) => set({ date, time: "" })} />
      <div className="space-y-3">
        <div className="flex items-center gap-2">
          <Clock className="h-4 w-4 text-primary" />
          <span className="text-sm font-semibold">{t.liff.selectSlotLabel}</span>
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
    </>
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

          <div className="grid gap-3 lg:grid-cols-2">
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
  services,
  rooms,
  catalog,
  idToken,
  onPetUpdated,
  t,
}: {
  draft: ItemDraft;
  onChange: (d: ItemDraft) => void;
  pet: CtxPet;
  /** บริการของประเภทนี้ที่กรองชนิดสัตว์แล้ว */
  services: Service[];
  rooms: Room[];
  catalog: FleaTickProductInfo[];
  idToken: string;
  onPetUpdated: () => Promise<void>;
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
          <FleaCheck
            key={`${pet.id}|${pet.lastFleaTickAt}|${pet.fleaTickProductId}`}
            pet={pet}
            serviceDate={draft.date}
            catalog={catalog}
            idToken={idToken}
            onSaved={onPetUpdated}
            t={t}
          />

          <Section title={t.liffBook.bathType}>
            <div className="grid gap-2">
              {groups.main.map((s) => (
                <OptionRow key={s.id} active={has(s.id)} label={s.name} price={s.price} onClick={() => pickOne(groups.main, s.id)} />
              ))}
            </div>
          </Section>

          {groups.groom.length > 0 && (
            <Section title={t.liffBook.groomType}>
              <div className="grid gap-2">
                <OptionRow active={!groomChosen} label={t.liffBook.noGroom} onClick={() => pickOne(groups.groom, null)} />
                {groups.groom.map((s) => (
                  <OptionRow key={s.id} active={has(s.id)} label={s.name} price={s.price} onClick={() => pickOne(groups.groom, s.id)} />
                ))}
              </div>
              {groomChosen && (
                <div className="space-y-3 border-t pt-3">
                  <div className="space-y-1.5">
                    <Label htmlFor="style-note">{t.liffBook.styleTitle}</Label>
                    <p className="text-xs text-muted-foreground">{t.liffBook.styleHint}</p>
                    <Textarea
                      id="style-note"
                      rows={2}
                      className="rounded-xl bg-card"
                      value={draft.styleNote}
                      onChange={(e) => set({ styleNote: e.target.value })}
                    />
                  </div>
                  <StyleImages images={draft.styleImages} onChange={(styleImages) => set({ styleImages })} t={t} />
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
                      <OptionRow key={s.id} active={has(s.id)} label={s.name} price={s.price} onClick={() => toggle(s.id)} />
                    ))}
                  </div>
                </Section>
              )}
            </div>
          )}
        </>
      )}

      {draft.kind !== "BATH" && pickable.length > 0 && (
        <Section title={draft.kind === "OTHER" ? t.liffBook.services : t.liff.servicesSectionTitle}>
          <div className="grid gap-2">
            {pickable.map((s) => (
              <OptionRow key={s.id} active={has(s.id)} label={s.name} price={s.price} onClick={() => toggle(s.id)} />
            ))}
          </div>
        </Section>
      )}

      {groups.free.length > 0 && (
        <Section title={t.liff.defaultServicesTitle}>
          <div className="grid gap-2">
            {groups.free.map((s) => (
              <OptionRow key={s.id} active={has(s.id)} label={s.name} price={s.price} onClick={() => toggle(s.id)} />
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
        <Section>
          <div className="flex items-center justify-between gap-3">
            <span className="text-sm font-semibold">{t.liffBook.estimate}</span>
            <span className="text-lg font-bold text-primary">{formatBaht(estimate)}</span>
          </div>
          <p className="text-sm font-medium">{t.liffBook.bathDeposit}</p>
          <p className="text-xs text-muted-foreground">{t.liffBook.priceNote}</p>
          <p className="text-xs text-muted-foreground">{t.liffBook.depositNote}</p>
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

/* ---------- หน้าต่างตรวจสอบรายการของสัตว์ตัวนี้ ---------- */

export function healthLines(pet: CtxPet, t: T): string[] {
  return [
    pet.allergies ? `${t.liffBook.allergies}: ${pet.allergies}` : null,
    pet.hasChronicDisease != null
      ? `${t.liffBook.disease}: ${pet.hasChronicDisease ? pet.chronicDiseaseNote || t.liffBook.diseaseYes : t.liffBook.diseaseNo}`
      : null,
    pet.groomingCautions ? `${t.liffBook.cautions}: ${pet.groomingCautions}` : null,
  ].filter((l): l is string => !!l);
}

export function whenLabel(draft: ItemDraft, t: T): string[] {
  const day = (d: string) => formatDateLong(thaiDayRange(d).start);
  if (draft.kind === "BOARDING") {
    return [t.liff.confirmCheckInLine(day(draft.date), draft.checkInTime), t.liff.confirmCheckOutLine(day(draft.checkOutDate), draft.checkOutTime)];
  }
  return [`${day(draft.date)} ${draft.time} ${t.liff.timeUnitSuffix}`];
}

export function ReviewDialog({
  open,
  onOpenChange,
  draft,
  pet,
  services,
  rooms,
  onConfirm,
  t,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  draft: ItemDraft;
  pet: CtxPet;
  services: Service[];
  rooms: Room[];
  onConfirm: () => void;
  t: T;
}) {
  const est = estimateDraft(draft, services, rooms);
  const names = [...(est.room ? [`${est.room.category.name} · ${est.room.name}`] : []), ...est.serviceNames];
  const health = healthLines(pet, t);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90dvh] overflow-y-auto rounded-3xl sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{t.liffBook.review}</DialogTitle>
        </DialogHeader>
        <dl className="space-y-3 text-sm">
          <div>
            <dt className="text-xs text-muted-foreground">{t.liffBook.petName}</dt>
            <dd className="font-semibold">
              {pet.name}
              {pet.weightKg ? <span className="font-normal text-muted-foreground"> · {pet.weightKg} กก.</span> : null}
            </dd>
          </div>
          {health.length > 0 && (
            <div>
              <dt className="text-xs text-muted-foreground">{t.liffBook.health}</dt>
              {health.map((l) => (
                <dd key={l}>{l}</dd>
              ))}
            </div>
          )}
          <div>
            <dt className="text-xs text-muted-foreground">{t.liffBook.kind[draft.kind]}</dt>
            {names.map((n) => (
              <dd key={n}>{n}</dd>
            ))}
            {draft.kind === "BATH" && draft.styleNote && (
              <dd className="text-muted-foreground">
                {t.liffBook.styleTitle}: {draft.styleNote}
              </dd>
            )}
            {draft.kind === "BATH" && draft.styleImages.length > 0 && (
              <dd className="mt-1 flex gap-1.5">
                {draft.styleImages.map((src, i) => (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img key={i} src={src} alt="" className="h-12 w-12 rounded-lg object-cover" />
                ))}
              </dd>
            )}
          </div>
          <div>
            <dt className="text-xs text-muted-foreground">{t.liffBook.when}</dt>
            {whenLabel(draft, t).map((l) => (
              <dd key={l}>{l}</dd>
            ))}
          </div>
          <div className="space-y-1 rounded-2xl bg-muted/50 p-3">
            <div className="flex justify-between gap-3">
              <span>{t.liffBook.estimate}</span>
              <span className="font-semibold">{formatBaht(est.estimate)}</span>
            </div>
            {draft.kind === "BATH" && <p className="font-medium">{t.liffBook.bathDeposit}</p>}
          </div>
        </dl>
        <p className="text-sm text-muted-foreground">{t.liffBook.reviewMessage}</p>
        <Button className="h-12 w-full rounded-2xl text-base" onClick={onConfirm}>
          {t.liffBook.addToCart}
        </Button>
      </DialogContent>
    </Dialog>
  );
}
