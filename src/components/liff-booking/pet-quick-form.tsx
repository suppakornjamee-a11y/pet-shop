"use client";

import { useMemo } from "react";
import { Plus, Trash2 } from "lucide-react";
import { matchMedicine, type FleaTickProductInfo } from "@/lib/flea-tick";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { todayStr, type Species, type T } from "./shared";

export type OwnerDraft = { name: string; phone: string; petInstagram: string };

export type PetDraft = {
  id?: string;
  name: string;
  species: Species;
  breed: string;
  birthDate: string;
  weightKg: string;
  allergies: string;
  groomingCautions: string;
  hasChronicDisease: "" | "no" | "yes";
  chronicDiseaseNote: string;
  fleaTickMedicine: string;
  fleaTickProductId: string | null;
  lastFleaTickDate: string;
};

export const emptyPetDraft = (): PetDraft => ({
  name: "",
  species: "DOG",
  breed: "",
  birthDate: "",
  weightKg: "",
  allergies: "",
  groomingCautions: "",
  hasChronicDisease: "",
  chronicDiseaseNote: "",
  fleaTickMedicine: "",
  fleaTickProductId: null,
  lastFleaTickDate: "",
});

/** แปลงฟอร์มเป็นข้อมูลที่ส่งให้ liffSaveQuickProfile (ตรวจความครบที่ฝั่ง server อีกชั้น) */
export function petDraftToInput(p: PetDraft) {
  return {
    id: p.id,
    name: p.name,
    species: p.species,
    breed: p.breed,
    birthDate: p.birthDate,
    weightKg: p.weightKg,
    allergies: p.allergies,
    groomingCautions: p.groomingCautions,
    hasChronicDisease: p.hasChronicDisease === "yes" ? true : p.hasChronicDisease === "no" ? false : undefined,
    chronicDiseaseNote: p.chronicDiseaseNote,
    fleaTickMedicine: p.fleaTickMedicine,
    fleaTickProductId: p.fleaTickProductId,
    lastFleaTickDate: p.lastFleaTickDate || undefined,
  };
}

const FIELD = "h-11 rounded-xl bg-card";

/** ชื่อยาเห็บหมัด — พิมพ์เอง แล้วระบบแสดงชื่อยาในฐานข้อมูลที่ใกล้เคียงให้กดเลือก (ไม่เลือกให้อัตโนมัติ) */
export function MedicineNameField({
  value,
  productId,
  species,
  catalog,
  onChange,
  t,
}: {
  value: string;
  productId: string | null;
  species: Species;
  catalog: FleaTickProductInfo[];
  onChange: (patch: { fleaTickMedicine?: string; fleaTickProductId?: string | null }) => void;
  t: T;
}) {
  const selected = catalog.find((p) => p.id === productId) ?? null;
  const matches = useMemo(
    () => (selected ? [] : matchMedicine(value, catalog, species).slice(0, 5)),
    [selected, value, catalog, species]
  );
  const describe = (p: FleaTickProductInfo) =>
    [p.formula, p.species ? t.labels.species[p.species] : null, t.fleaTick.form[p.form]].filter(Boolean).join(" · ");

  return (
    <div className="space-y-1.5">
      <Input
        className={FIELD}
        value={value}
        onChange={(e) => onChange({ fleaTickMedicine: e.target.value, fleaTickProductId: null })}
      />
      {selected ? (
        <div className="flex items-start justify-between gap-2 rounded-xl border border-primary/40 bg-primary/5 px-3 py-2 text-sm">
          <div className="min-w-0">
            <div className="font-medium">{selected.name}</div>
            <div className="text-xs text-muted-foreground">{describe(selected)}</div>
          </div>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-7 shrink-0 px-2 text-xs"
            onClick={() => onChange({ fleaTickProductId: null })}
          >
            {t.fleaTick.change}
          </Button>
        </div>
      ) : (
        value.trim().length >= 2 &&
        matches.length > 0 && (
          <div className="space-y-1.5">
            {matches.length > 1 && <p className="text-xs text-amber-700">{t.fleaTick.pickFormulaHint}</p>}
            {matches.map(({ product }) => (
              <button
                key={product.id}
                type="button"
                onClick={() => onChange({ fleaTickProductId: product.id })}
                className="flex w-full flex-col items-start rounded-xl border bg-card px-3 py-2 text-left text-sm transition-colors hover:bg-accent/40"
              >
                <span className="font-medium">{product.name}</span>
                <span className="text-xs text-muted-foreground">{describe(product)}</span>
              </button>
            ))}
          </div>
        )
      )}
    </div>
  );
}

export function OwnerFields({ owner, onChange, t }: { owner: OwnerDraft; onChange: (o: OwnerDraft) => void; t: T }) {
  return (
    <div className="space-y-3 rounded-2xl border bg-card p-4">
      <p className="text-sm font-semibold">{t.liffBook.ownerTitle}</p>
      <div className="space-y-1.5">
        <Label htmlFor="ow-name">{t.liffBook.ownerName}</Label>
        <Input id="ow-name" className={FIELD} value={owner.name} onChange={(e) => onChange({ ...owner, name: e.target.value })} />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="ow-phone">{t.liffBook.phone}</Label>
        <Input
          id="ow-phone"
          className={FIELD}
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

/** ข้อมูลสัตว์เลี้ยงหนึ่งตัว — ชุดช่องตามที่ร้านกำหนดสำหรับงานอาบน้ำ/กรูมมิ่ง */
export function PetFields({
  pet,
  index,
  catalog,
  onChange,
  onRemove,
  t,
}: {
  pet: PetDraft;
  index: number;
  catalog: FleaTickProductInfo[];
  onChange: (p: PetDraft) => void;
  onRemove?: () => void;
  t: T;
}) {
  const set = (patch: Partial<PetDraft>) => onChange({ ...pet, ...patch });
  const id = (f: string) => `pet-${index}-${f}`;

  return (
    <div className="space-y-3 rounded-2xl border bg-card p-4">
      <div className="flex items-center justify-between">
        <p className="text-sm font-semibold">{t.liffBook.petTitle}</p>
        {onRemove && (
          <Button type="button" variant="ghost" size="sm" className="h-7 px-2 text-xs text-destructive" onClick={onRemove}>
            <Trash2 className="h-3.5 w-3.5" /> {t.liffBook.removePet}
          </Button>
        )}
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor={id("name")}>{t.liffBook.petName}</Label>
          <Input id={id("name")} className={FIELD} value={pet.name} onChange={(e) => set({ name: e.target.value })} />
        </div>
        <div className="space-y-1.5">
          <Label>{t.liffBook.species}</Label>
          <div className="grid grid-cols-2 gap-2">
            {(["DOG", "CAT"] as const).map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => set({ species: s, fleaTickProductId: null })}
                className={cn(
                  "h-11 rounded-xl border text-sm transition-colors",
                  pet.species === s ? "border-primary bg-primary/10 font-medium text-primary" : "bg-card hover:bg-muted"
                )}
              >
                {t.labels.species[s]}
              </button>
            ))}
          </div>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor={id("breed")}>{t.liffBook.breed}</Label>
          <Input id={id("breed")} className={FIELD} value={pet.breed} onChange={(e) => set({ breed: e.target.value })} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor={id("birth")}>{t.liffBook.birthDate}</Label>
          <Input
            id={id("birth")}
            type="date"
            lang="en-GB"
            max={todayStr()}
            className={FIELD}
            value={pet.birthDate}
            onChange={(e) => set({ birthDate: e.target.value })}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor={id("weight")}>{t.liffBook.weight}</Label>
          <Input
            id={id("weight")}
            type="number"
            inputMode="decimal"
            min={0}
            step="0.1"
            className={FIELD}
            value={pet.weightKg}
            onChange={(e) => set({ weightKg: e.target.value })}
          />
        </div>
      </div>
      <div className="space-y-1.5">
        <Label htmlFor={id("allergy")}>{t.liffBook.allergies}</Label>
        <Textarea
          id={id("allergy")}
          rows={2}
          className="rounded-xl bg-card"
          placeholder={t.liffBook.allergiesPlaceholder}
          value={pet.allergies}
          onChange={(e) => set({ allergies: e.target.value })}
        />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor={id("caution")}>{t.liffBook.cautions}</Label>
        <Textarea
          id={id("caution")}
          rows={2}
          className="rounded-xl bg-card"
          placeholder={t.liffBook.cautionsPlaceholder}
          value={pet.groomingCautions}
          onChange={(e) => set({ groomingCautions: e.target.value })}
        />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor={id("disease")}>{t.liffBook.disease}</Label>
        <select
          id={id("disease")}
          className="h-11 w-full rounded-xl border bg-card px-3 text-sm"
          value={pet.hasChronicDisease}
          onChange={(e) => set({ hasChronicDisease: e.target.value as PetDraft["hasChronicDisease"] })}
        >
          <option value="" disabled />
          <option value="no">{t.liffBook.diseaseNo}</option>
          <option value="yes">{t.liffBook.diseaseYes}</option>
        </select>
        {pet.hasChronicDisease === "yes" && (
          <Textarea
            rows={2}
            className="rounded-xl bg-card"
            placeholder={t.liffBook.diseasePlaceholder}
            value={pet.chronicDiseaseNote}
            onChange={(e) => set({ chronicDiseaseNote: e.target.value })}
          />
        )}
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label>{t.liffBook.fleaMedicine}</Label>
          <MedicineNameField
            value={pet.fleaTickMedicine}
            productId={pet.fleaTickProductId}
            species={pet.species}
            catalog={catalog}
            onChange={(patch) => set(patch)}
            t={t}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor={id("flea-date")}>{t.liffBook.fleaDate}</Label>
          <Input
            id={id("flea-date")}
            type="date"
            lang="en-GB"
            max={todayStr()}
            className={FIELD}
            value={pet.lastFleaTickDate}
            onChange={(e) => set({ lastFleaTickDate: e.target.value })}
          />
        </div>
      </div>
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
