"use client";

import type { FleaTickProductInfo } from "@/lib/flea-tick";
import { assessFleaTick, validateFleaDeclaration } from "@/lib/flea-tick-check";
import { EMPTY_FLEA, type ItemDraft } from "./cart";
import { declarationError, fleaDataOf } from "./flea-validation";
import type { FieldError } from "./pet-quick-form";
import { todayStr, type CtxPet, type T } from "./shared";

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
