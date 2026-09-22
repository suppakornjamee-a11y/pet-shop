"use client";

import { Bug } from "lucide-react";
import type { FleaTickProductInfo } from "@/lib/flea-tick";
import { assessFleaTick, validateFleaDeclaration } from "@/lib/flea-tick-check";
import { cn } from "@/lib/utils";
import { MedicineNameField } from "@/components/medicine-name-field";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { EMPTY_FLEA, type FleaDraft, type ItemDraft } from "./cart";
import { declarationError, fleaDataOf } from "./flea-validation";
import { ImagePicker } from "./image-picker";
import type { FieldError } from "./pet-quick-form";
import { Section, todayStr, type CtxPet, type T } from "./shared";

const FIELD = "h-11 rounded-xl bg-card";
const INVALID = "border-destructive focus-visible:border-destructive focus-visible:ring-destructive/40";

/**
 * ตรวจข้อมูลยาที่ลูกค้าแจ้งใหม่ (จากฟอร์ม "มีข้อมูลอัปเดต") ก่อนไปหน้าตรวจสอบรายการ — คืนช่องแรกที่ยังไม่ครบ
 * (เซิร์ฟเวอร์ตรวจซ้ำอีกชั้น) ถ้าไม่ได้แจ้งข้อมูลใหม่ไม่มีอะไรต้องตรวจ
 */
export function validateFleaForDraft(
  draft: ItemDraft,
  pet: CtxPet,
  catalog: FleaTickProductInfo[],
  t: T
): FieldError | null {
  if (draft.kind !== "BATH") return null;
  const flea = draft.flea ?? EMPTY_FLEA;
  if (flea.choice !== "declare") return null;

  const stored = fleaDataOf(pet);
  const today = todayStr();
  const pre = assessFleaTick(stored, catalog, draft.date, today);
  const error = validateFleaDeclaration({
    declaration: { medicine: flea.medicine, productId: flea.productId, date: flea.date, evidence: flea.evidence },
    pre,
    stored,
    catalog,
    today,
  });
  return error ? declarationError(error, stored, t) : null;
}

/**
 * ตรวจยาเห็บหมัดตอนเลือกวันเวลา (งานอาบน้ำ) — เทียบ "วันที่ให้ยา + ระยะคุ้มครองของยา" กับวันบริการที่เลือก
 * ผ่าน: ตราเขียว + "ผ่านการให้ยาแล้ว" · ไม่ผ่าน (หมดช่วงคุ้มครอง ไม่มีข้อมูล ยาไม่อยู่ในระบบ ฯลฯ): ตรารอตรวจสอบเป็นไอคอนอย่างเดียว
 * แล้วให้แอดมินตรวจตอนเช็คคิว — ไม่ถามอะไรลูกค้าในหน้านี้ (แก้ข้อมูลยาได้ที่ฟอร์ม "มีข้อมูลอัปเดต" ของหน้าแรก)
 * ถ้าลูกค้าแจ้งข้อมูลยาใหม่มาจากหน้าแรก จะเห็นช่องข้อมูลที่แจ้งไว้ตรงนี้เพื่อแก้ไข/แนบหลักฐานเพิ่มได้ และผลของตราคิดจากข้อมูลที่แจ้ง
 */
export function FleaTickSection({
  draft,
  set,
  pet,
  catalog,
  invalidId,
  t,
}: {
  draft: ItemDraft;
  set: (patch: Partial<ItemDraft>) => void;
  pet: CtxPet;
  catalog: FleaTickProductInfo[];
  invalidId?: string | null;
  t: T;
}) {
  const today = todayStr();
  const flea = draft.flea ?? EMPTY_FLEA;
  const declared = flea.choice === "declare";
  const setFlea = (patch: Partial<FleaDraft>) => set({ flea: { ...flea, ...patch } });
  const bad = (id: string) => invalidId === id;

  // ตราผ่าน/รอตรวจสอบย้ายไปแสดงที่การ์ดข้อมูลสัตว์ในหน้าแรกแล้ว — หน้านี้เหลือแค่ฟอร์มแจ้งข้อมูลใหม่ (เมื่อลูกค้าเลือก "มีข้อมูลอัปเดต" จากหน้าแรก)
  if (!declared) return null;

  return (
    <Section title={t.fleaTick.title} icon={Bug}>
      <div className="space-y-3">
        <div className="space-y-1.5">
          <Label htmlFor="flea-medicine">{t.liffBook.fleaMedicine}</Label>
          <MedicineNameField
            inputId="flea-medicine"
            invalid={bad("flea-medicine")}
            value={flea.medicine}
            productId={flea.productId}
            species={pet.species}
            catalog={catalog}
            onChange={(patch) =>
              setFlea({
                medicine: patch.fleaTickMedicine ?? flea.medicine,
                productId: patch.fleaTickProductId !== undefined ? patch.fleaTickProductId : flea.productId,
              })
            }
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="flea-date">{t.liffBook.fleaDate}</Label>
          <Input
            id="flea-date"
            type="date"
            lang="en-GB"
            max={today}
            className={cn(FIELD, bad("flea-date") && INVALID)}
            value={flea.date}
            onChange={(e) => setFlea({ date: e.target.value })}
          />
        </div>
        <ImagePicker
          id="flea-evidence"
          label={t.fleaTick.evidenceLabel}
          images={flea.evidence}
          onChange={(evidence) => setFlea({ evidence })}
          max={3}
          maxSide={1100}
          invalid={bad("flea-evidence")}
          t={t}
        />
        <Button type="button" variant="ghost" size="sm" onClick={() => setFlea({ choice: "" })}>
          {t.common.cancel}
        </Button>
      </div>
    </Section>
  );
}
