"use client";

import { Plus, Trash2 } from "lucide-react";
import type { FleaTickProductInfo } from "@/lib/flea-tick";
import { assessFleaTick, fleaInfoChanged, validateFleaDeclaration, type FleaDeclaration } from "@/lib/flea-tick-check";
import { petAge } from "@/lib/pet-age";
import { formatDateLong } from "@/lib/format";
import { thaiDayRange } from "@/lib/slots";
import { cn } from "@/lib/utils";
import { MedicineNameField, fitsSpecies } from "@/components/medicine-name-field";
import { SpeciesIcon } from "@/components/species-icon";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { declarationError, fleaDataOf, type FleaFieldIds } from "./flea-validation";
import { ImagePicker } from "./image-picker";
import { todayStr, type CtxPet, type Species, type T } from "./shared";

export type OwnerDraft = { name: string; phone: string; petInstagram: string };

/** ช่องแบบ "ไม่มี / มี แล้วระบุรายละเอียด" — ใช้กับอาการแพ้ ข้อควรระวัง และโรคประจำตัว */
export type HasDetail = "" | "no" | "yes";

export type PetDraft = {
  id?: string;
  name: string;
  species: Species;
  breed: string;
  birthDate: string;
  weightKg: string;
  hasAllergies: HasDetail;
  allergies: string;
  hasCautions: HasDetail;
  groomingCautions: string;
  hasChronicDisease: HasDetail;
  chronicDiseaseNote: string;
  fleaTickMedicine: string;
  fleaTickProductId: string | null;
  lastFleaTickDate: string;
  /** รูปหลักฐานยาเห็บหมัด — ใช้เฉพาะตอนสัตว์เดิมเลือก "มีข้อมูลอัปเดต" แล้วแก้ข้อมูลยา */
  fleaEvidence: string[];
  /** เฉพาะสัตว์ที่มีข้อมูลอยู่แล้ว: ลูกค้ายืนยันว่าข้อมูลเดิมยังถูกต้อง หรือมีข้อมูลอัปเดต */
  infoStatus: "" | "same" | "update";
};

export const emptyPetDraft = (): PetDraft => ({
  name: "",
  species: "DOG",
  breed: "",
  birthDate: "",
  weightKg: "",
  hasAllergies: "",
  allergies: "",
  hasCautions: "",
  groomingCautions: "",
  hasChronicDisease: "",
  chronicDiseaseNote: "",
  fleaTickMedicine: "",
  fleaTickProductId: null,
  lastFleaTickDate: "",
  fleaEvidence: [],
  infoStatus: "",
});

/** ข้อมูลยาเห็บหมัดในฟอร์มตอนนี้ ในรูปที่ตัวตรวจใช้ */
export function fleaDeclarationOf(p: PetDraft): FleaDeclaration {
  return {
    medicine: p.fleaTickMedicine,
    productId: p.fleaTickProductId,
    date: p.lastFleaTickDate,
    evidence: p.fleaEvidence,
  };
}

/** ค่าที่เก็บในฐานข้อมูลเป็นข้อความเดียว — "ไม่มี" หรือรายละเอียดที่ลูกค้าระบุ */
const detailValue = (has: HasDetail, note: string, noneLabel: string) => (has === "yes" ? note : noneLabel);

/** แปลงข้อความที่เก็บไว้กลับเป็นตัวเลือก + รายละเอียด (ข้อมูลเดิมที่พิมพ์ว่าไม่มี ถือเป็น "ไม่มี") */
export function splitDetail(value: string | null): { has: HasDetail; note: string } {
  const text = (value ?? "").trim();
  if (!text) return { has: "", note: "" };
  return /^(ไม่มี|-|none|no)$/i.test(text) ? { has: "no", note: "" } : { has: "yes", note: text };
}

/** แปลงฟอร์มเป็นข้อมูลที่ส่งให้ liffSaveQuickProfile (ตรวจความครบที่ฝั่ง server อีกชั้น) */
export function petDraftToInput(p: PetDraft, noneLabel: string) {
  return {
    id: p.id,
    name: p.name,
    species: p.species,
    breed: p.breed,
    birthDate: p.birthDate,
    weightKg: p.weightKg,
    allergies: detailValue(p.hasAllergies, p.allergies, noneLabel),
    groomingCautions: detailValue(p.hasCautions, p.groomingCautions, noneLabel),
    hasChronicDisease: p.hasChronicDisease === "yes" ? true : p.hasChronicDisease === "no" ? false : undefined,
    chronicDiseaseNote: p.chronicDiseaseNote,
    // ข้อมูลยาเห็บหมัดส่งเฉพาะสัตว์ใหม่ — สัตว์เดิมแก้ผ่านขั้นตรวจยาตอนเลือกวันเวลา
    ...(p.id
      ? {}
      : {
          fleaTickMedicine: p.fleaTickMedicine,
          fleaTickProductId: p.fleaTickProductId,
          lastFleaTickDate: p.lastFleaTickDate || undefined,
        }),
  };
}

/* ---------- ตรวจความครบก่อนส่ง (ชี้ช่องแรกที่ยังไม่ครบให้ลูกค้าเห็น) ---------- */

export type FieldError = { id: string; message: string };

export function petFieldId(index: number, field: string) {
  return `pet-${index}-${field}`;
}

export function validateOwner(owner: OwnerDraft, t: T): FieldError | null {
  if (!owner.name.trim()) return { id: "ow-name", message: t.liffBook.requiredField(t.liffBook.ownerName) };
  if (owner.phone.trim().length < 6) return { id: "ow-phone", message: t.liffBook.requiredField(t.liffBook.phone) };
  return null;
}

export function validatePet(pet: PetDraft, index: number, t: T): FieldError | null {
  const id = (f: string) => petFieldId(index, f);
  const need = (label: string) => t.liffBook.requiredField(label);
  if (!pet.name.trim()) return { id: id("name"), message: need(t.liffBook.petName) };
  if (!pet.breed.trim()) return { id: id("breed"), message: need(t.liffBook.breed) };
  if (!pet.birthDate) return { id: id("birth"), message: need(t.liffBook.birthDate) };
  if (!(Number(pet.weightKg) > 0)) return { id: id("weight"), message: need(t.liffBook.weight) };
  if (!pet.hasAllergies) return { id: id("allergy"), message: need(t.liffBook.allergies) };
  if (pet.hasAllergies === "yes" && !pet.allergies.trim()) return { id: id("allergy-note"), message: t.liffBook.detailPlaceholder };
  if (!pet.hasCautions) return { id: id("caution"), message: need(t.liffBook.cautions) };
  if (pet.hasCautions === "yes" && !pet.groomingCautions.trim())
    return { id: id("caution-note"), message: t.liffBook.detailPlaceholder };
  if (!pet.hasChronicDisease) return { id: id("disease"), message: need(t.liffBook.disease) };
  if (pet.hasChronicDisease === "yes" && !pet.chronicDiseaseNote.trim())
    return { id: id("disease-note"), message: t.liffBook.detailPlaceholder };
  return null;
}

const INFO_FLEA_IDS: FleaFieldIds = {
  medicine: petFieldId(0, "flea-medicine"),
  date: petFieldId(0, "flea-date"),
  evidence: petFieldId(0, "flea-evidence"),
};

/**
 * สัตว์เลี้ยงที่มีข้อมูลอยู่แล้ว — ต้องมีน้ำหนักล่าสุด และเลือกว่าข้อมูลเดิมถูกต้องหรือมีอัปเดต
 * ถ้าอัปเดตต้องกรอกครบเหมือนสัตว์ใหม่ และถ้าแก้ข้อมูลยาเห็บหมัดต้องผ่านกติกาเดียวกับส่วนตรวจยาตอนเลือกวันเวลา
 * (เปลี่ยนยาต้องกรอกวันที่ใหม่ + แนบหลักฐาน ฯลฯ) — ยังไม่รู้วันบริการตอนนี้ จึงเทียบกับวันนี้ไปก่อน แล้วตรวจซ้ำอีกรอบเมื่อเลือกวันแล้ว
 */
export function validateExistingPet(
  pet: PetDraft,
  original: CtxPet | undefined,
  catalog: FleaTickProductInfo[],
  t: T
): FieldError | null {
  if (!pet.infoStatus) return { id: petFieldId(0, "info"), message: t.liffBook.infoRequired };
  if (pet.infoStatus !== "update") return null;
  const health = validatePet(pet, 0, t);
  if (health || !original) return health;

  const stored = fleaDataOf(original);
  const declaration = fleaDeclarationOf(pet);
  if (!fleaInfoChanged(stored, declaration)) return null;
  const today = todayStr();
  const pre = assessFleaTick(stored, catalog, today, today);
  const error = validateFleaDeclaration({ declaration, pre, stored, catalog, today });
  return error ? declarationError(error, stored, t, INFO_FLEA_IDS) : null;
}

/** โฟกัสช่องที่ยังไม่ครบและเลื่อนจอไปหา */
export function focusField(id: string) {
  const el = document.getElementById(id);
  if (!(el instanceof HTMLElement)) return;
  el.scrollIntoView({ block: "center", behavior: "smooth" });
  el.focus({ preventScroll: true });
}

const FIELD = "h-11 rounded-xl bg-card";
const SELECT = "h-11 w-full rounded-xl border bg-card px-3 text-sm";
/** ช่องที่ยังไม่ครบ — ขอบและวงโฟกัสเป็นสีแดงจนกว่าจะกรอก */
const INVALID = "border-destructive focus-visible:border-destructive focus-visible:ring-destructive/40";

export function OwnerFields({
  owner,
  onChange,
  invalidId,
  t,
}: {
  owner: OwnerDraft;
  onChange: (o: OwnerDraft) => void;
  invalidId?: string | null;
  t: T;
}) {
  const bad = (id: string) => invalidId === id;
  return (
    <div className="space-y-3 rounded-2xl border bg-card p-4">
      <p className="text-sm font-semibold">{t.liffBook.ownerTitle}</p>
      <div className="space-y-1.5">
        <Label htmlFor="ow-name">{t.liffBook.ownerName}</Label>
        <Input
          id="ow-name"
          className={cn(FIELD, bad("ow-name") && INVALID)}
          value={owner.name}
          onChange={(e) => onChange({ ...owner, name: e.target.value })}
        />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="ow-phone">{t.liffBook.phone}</Label>
        <Input
          id="ow-phone"
          className={cn(FIELD, bad("ow-phone") && INVALID)}
          inputMode="tel"
          value={owner.phone}
          onChange={(e) => onChange({ ...owner, phone: e.target.value })}
        />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="ow-ig">{t.liffBook.petInstagram}</Label>
        <Input
          id="ow-ig"
          className={FIELD}
          value={owner.petInstagram}
          onChange={(e) => onChange({ ...owner, petInstagram: e.target.value })}
        />
      </div>
    </div>
  );
}

/** ช่อง "ไม่มี / มี" + ช่องรายละเอียดที่ต้องกรอกเมื่อเลือกมี (อาการแพ้ / ข้อควรระวัง / โรคประจำตัว) */
function DetailField({
  fieldId,
  label,
  has,
  note,
  onHas,
  onNote,
  invalidId,
  t,
}: {
  fieldId: string;
  label: string;
  has: HasDetail;
  note: string;
  onHas: (v: HasDetail) => void;
  onNote: (v: string) => void;
  invalidId?: string | null;
  t: T;
}) {
  const noteId = `${fieldId}-note`;
  return (
    <div className="space-y-1.5">
      <Label htmlFor={fieldId}>{label}</Label>
      <select
        id={fieldId}
        className={cn(SELECT, invalidId === fieldId && INVALID)}
        value={has}
        onChange={(e) => onHas(e.target.value as HasDetail)}
      >
        <option value="" disabled />
        <option value="no">{t.liffBook.diseaseNo}</option>
        <option value="yes">{t.liffBook.diseaseYes}</option>
      </select>
      {has === "yes" && (
        <Textarea
          id={noteId}
          rows={2}
          className={cn("rounded-xl bg-card", invalidId === noteId && INVALID)}
          placeholder={t.liffBook.detailPlaceholder}
          value={note}
          onChange={(e) => onNote(e.target.value)}
        />
      )}
    </div>
  );
}

/** ข้อมูลสัตว์เลี้ยงหนึ่งตัว — ชุดช่องตามที่ร้านกำหนดสำหรับงานอาบน้ำ/กรูมมิ่ง
 * bare = ฝังอยู่ในการ์ดอื่น (ไม่มีกรอบและหัวข้อของตัวเอง), hideWeight = น้ำหนักแสดงที่อื่นในการ์ดแม่แล้ว,
 * hideFlea = ไม่แสดงช่องยาเห็บหมัด, showFleaEvidence = แสดงช่องแนบรูปหลักฐานยา (สัตว์เดิมที่แก้ข้อมูลยา) */
export function PetFields({
  pet,
  index,
  catalog,
  onChange,
  onRemove,
  invalidId,
  hideWeight = false,
  hideFlea = false,
  showFleaEvidence = false,
  bare = false,
  t,
}: {
  pet: PetDraft;
  index: number;
  catalog: FleaTickProductInfo[];
  onChange: (p: PetDraft) => void;
  onRemove?: () => void;
  invalidId?: string | null;
  hideWeight?: boolean;
  hideFlea?: boolean;
  showFleaEvidence?: boolean;
  bare?: boolean;
  t: T;
}) {
  const set = (patch: Partial<PetDraft>) => onChange({ ...pet, ...patch });
  const id = (f: string) => petFieldId(index, f);
  const bad = (f: string) => invalidId === id(f);
  const age = petAge(pet.birthDate, todayStr());

  return (
    <div className={bare ? "space-y-3 border-t pt-3" : "space-y-3 rounded-2xl border bg-card p-4"}>
      {!bare && (
        <div className="flex items-center justify-between">
          <p className="text-sm font-semibold">{t.liffBook.petTitle}</p>
          {onRemove && (
            <Button type="button" variant="ghost" size="sm" className="h-7 px-2 text-xs text-destructive" onClick={onRemove}>
              <Trash2 className="h-3.5 w-3.5" /> {t.liffBook.removePet}
            </Button>
          )}
        </div>
      )}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor={id("name")}>{t.liffBook.petName}</Label>
          <Input
            id={id("name")}
            className={cn(FIELD, bad("name") && INVALID)}
            value={pet.name}
            onChange={(e) => set({ name: e.target.value })}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor={id("species")}>{t.liffBook.species}</Label>
          <select
            id={id("species")}
            className={SELECT}
            value={pet.species}
            onChange={(e) => {
              const next = e.target.value as Species;
              const chosen = catalog.find((p) => p.id === pet.fleaTickProductId);
              if (!chosen || fitsSpecies(chosen, next)) {
                set({ species: next });
              } else {
                set({
                  species: next,
                  fleaTickProductId: null,
                  fleaTickMedicine: pet.fleaTickMedicine === chosen.name ? "" : pet.fleaTickMedicine,
                });
              }
            }}
          >
            {(["DOG", "CAT"] as const).map((s) => (
              <option key={s} value={s}>
                {t.labels.species[s]}
              </option>
            ))}
          </select>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor={id("breed")}>{t.liffBook.breed}</Label>
          <Input
            id={id("breed")}
            className={cn(FIELD, bad("breed") && INVALID)}
            value={pet.breed}
            onChange={(e) => set({ breed: e.target.value })}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor={id("birth")}>{t.liffBook.birthDate}</Label>
          <Input
            id={id("birth")}
            type="date"
            lang="en-GB"
            max={todayStr()}
            className={cn(FIELD, bad("birth") && INVALID)}
            value={pet.birthDate}
            onChange={(e) => set({ birthDate: e.target.value })}
          />
          {age && <p className="text-xs text-muted-foreground">{t.liffBook.age(age.years, age.months)}</p>}
        </div>
        {!hideWeight && (
          <div className="space-y-1.5">
            <Label htmlFor={id("weight")}>{t.liffBook.weight}</Label>
            <Input
              id={id("weight")}
              type="number"
              inputMode="decimal"
              min={0}
              step="0.1"
              className={cn(FIELD, bad("weight") && INVALID)}
              value={pet.weightKg}
              onChange={(e) => set({ weightKg: e.target.value })}
            />
          </div>
        )}
      </div>

      <DetailField
        fieldId={id("allergy")}
        label={t.liffBook.allergies}
        has={pet.hasAllergies}
        note={pet.allergies}
        onHas={(v) => set({ hasAllergies: v })}
        onNote={(v) => set({ allergies: v })}
        invalidId={invalidId}
        t={t}
      />
      <DetailField
        fieldId={id("caution")}
        label={t.liffBook.cautions}
        has={pet.hasCautions}
        note={pet.groomingCautions}
        onHas={(v) => set({ hasCautions: v })}
        onNote={(v) => set({ groomingCautions: v })}
        invalidId={invalidId}
        t={t}
      />
      <DetailField
        fieldId={id("disease")}
        label={t.liffBook.disease}
        has={pet.hasChronicDisease}
        note={pet.chronicDiseaseNote}
        onHas={(v) => set({ hasChronicDisease: v })}
        onNote={(v) => set({ chronicDiseaseNote: v })}
        invalidId={invalidId}
        t={t}
      />

      {!hideFlea && (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor={id("flea-medicine")}>{t.liffBook.fleaMedicine}</Label>
            <MedicineNameField
              value={pet.fleaTickMedicine}
              productId={pet.fleaTickProductId}
              species={pet.species}
              catalog={catalog}
              onChange={(patch) => set(patch)}
              inputId={id("flea-medicine")}
              invalid={bad("flea-medicine")}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor={id("flea-date")}>{t.liffBook.fleaDate}</Label>
            <Input
              id={id("flea-date")}
              type="date"
              lang="en-GB"
              max={todayStr()}
              className={cn(FIELD, bad("flea-date") && INVALID)}
              value={pet.lastFleaTickDate}
              onChange={(e) => set({ lastFleaTickDate: e.target.value })}
            />
          </div>
        </div>
      )}
      {!hideFlea && showFleaEvidence && (
        <ImagePicker
          id={id("flea-evidence")}
          label={t.fleaTick.evidenceLabel}
          images={pet.fleaEvidence}
          onChange={(fleaEvidence) => set({ fleaEvidence })}
          max={3}
          maxSide={1100}
          invalid={bad("flea-evidence")}
          t={t}
        />
      )}
    </div>
  );
}

/**
 * สัตว์เลี้ยงที่มีข้อมูลอยู่แล้ว — แสดงน้ำหนักเดิมให้ยืนยันหรือแก้เป็นน้ำหนักล่าสุด แสดงประวัติแพ้ โรคประจำตัว
 * และข้อควรระวังเดิม แล้วให้เลือก "ข้อมูลเดิมยังถูกต้อง" หรือ "มีข้อมูลอัปเดต" (เลือกอัปเดตถึงจะแก้ข้อมูลอื่นได้)
 */
export function ExistingPetFields({
  pet,
  catalog,
  onChange,
  invalidId,
  t,
}: {
  pet: PetDraft;
  catalog: FleaTickProductInfo[];
  onChange: (p: PetDraft) => void;
  invalidId?: string | null;
  t: T;
}) {
  const id = (f: string) => petFieldId(0, f);
  const bad = (f: string) => invalidId === id(f);
  const age = petAge(pet.birthDate, todayStr());
  // น้ำหนักหรือข้อมูลสุขภาพเดิมที่ยังไม่เคยกรอกครบ (สัตว์ที่พนักงานลงทะเบียนไว้ก่อนมีช่องเหล่านี้) ยืนยันว่า "ถูกต้อง" ไม่ได้ — ต้องกรอกเพิ่ม
  const incomplete = !(Number(pet.weightKg) > 0) || !pet.hasAllergies || !pet.hasCautions || !pet.hasChronicDisease;
  const shown = (has: HasDetail, note: string) => (has === "yes" ? note : has === "no" ? t.liffBook.diseaseNo : "-");
  const rows: [string, string][] = [
    [t.liffBook.weight, pet.weightKg || "-"],
    [t.liffBook.allergies, shown(pet.hasAllergies, pet.allergies)],
    [t.liffBook.disease, shown(pet.hasChronicDisease, pet.chronicDiseaseNote)],
    [t.liffBook.cautions, shown(pet.hasCautions, pet.groomingCautions)],
    // ยาเห็บหมัดที่เคยแจ้งไว้ — ชื่อจากฐานข้อมูลยาถ้าเคยเลือกไว้ ไม่งั้นใช้ชื่อที่ลูกค้าพิมพ์
    [
      t.liffBook.fleaMedicine,
      catalog.find((p) => p.id === pet.fleaTickProductId)?.name || pet.fleaTickMedicine.trim() || "-",
    ],
    [
      t.liffBook.fleaDate,
      pet.lastFleaTickDate ? formatDateLong(thaiDayRange(pet.lastFleaTickDate).start) : "-",
    ],
  ];

  return (
    <div className="space-y-4 rounded-2xl border bg-card p-4 shadow-[0_1px_2px_rgba(0,0,0,0.03)]">
      <div className="flex items-center gap-3">
        <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-accent/50 text-primary">
          <SpeciesIcon species={pet.species} className="h-7 w-7" />
        </span>
        <div className="min-w-0">
          <p className="text-base font-semibold leading-tight">{pet.name}</p>
          <p className="mt-0.5 text-xs text-muted-foreground">
            {[t.labels.species[pet.species], pet.breed, age ? t.liffBook.age(age.years, age.months) : null]
              .filter(Boolean)
              .join(" · ")}
          </p>
        </div>
      </div>

      {pet.infoStatus !== "update" && (
        <div className="space-y-2">
          <p className="text-sm font-semibold">{t.liffBook.health}</p>
          <dl className="divide-y rounded-xl border bg-muted/30 text-sm">
            {rows.map(([label, value]) => (
              <div key={label} className="flex flex-col gap-0.5 px-3 py-2 sm:flex-row sm:items-start sm:justify-between sm:gap-4">
                <dt className="shrink-0 text-xs text-muted-foreground sm:max-w-[45%] sm:text-sm">{label}</dt>
                <dd className="font-medium sm:text-right">{value}</dd>
              </div>
            ))}
          </dl>
        </div>
      )}

      <div className="space-y-1.5">
        <Label htmlFor={id("info")}>{t.liffBook.infoConfirmLabel}</Label>
        <select
          id={id("info")}
          className={cn(SELECT, bad("info") && INVALID)}
          value={pet.infoStatus}
          onChange={(e) => onChange({ ...pet, infoStatus: e.target.value as PetDraft["infoStatus"] })}
        >
          <option value="" disabled>
            {t.liffBook.infoPlaceholder}
          </option>
          <option value="same" disabled={incomplete}>
            {t.liffBook.infoSame}
          </option>
          <option value="update">{t.liffBook.infoUpdate}</option>
        </select>
      </div>

      {pet.infoStatus === "update" && (
        <PetFields
          pet={pet}
          index={0}
          catalog={catalog}
          onChange={onChange}
          invalidId={invalidId}
          showFleaEvidence
          bare
          t={t}
        />
      )}
    </div>
  );
}

export function AddPetButton({ onClick, t }: { onClick: () => void; t: T }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex w-full items-center justify-center gap-1.5 rounded-2xl border border-dashed py-3 text-sm text-primary transition-colors hover:bg-accent/30"
    >
      <Plus className="h-4 w-4" /> {t.liffBook.addPet}
    </button>
  );
}
