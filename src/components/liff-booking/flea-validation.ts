import { formatDateLong } from "@/lib/format";
import { thaiDayRange } from "@/lib/slots";
import type { FleaDeclarationError, FleaPetData } from "@/lib/flea-tick-check";
import type { FieldError } from "./pet-quick-form";
import type { CtxPet, T } from "./shared";

/** ข้อมูลยาเห็บหมัดที่บันทึกไว้กับสัตว์เลี้ยง ในรูปที่ตัวตรวจใช้ */
export function fleaDataOf(pet: CtxPet): FleaPetData {
  return {
    species: pet.species,
    birthDate: pet.birthDate || null,
    medicine: pet.fleaTickMedicine ?? "",
    productId: pet.fleaTickProductId,
    givenAt: pet.lastFleaTickAt || null,
  };
}

export const dayLabel = (d: string) => formatDateLong(thaiDayRange(d).start);

/** รหัสช่องที่ข้อผิดพลาดของคำตอบเรื่องยาไปชี้ (ต่างกันระหว่างฟอร์มข้อมูลสัตว์กับส่วนตรวจยาตอนเลือกวันเวลา) */
export type FleaFieldIds = { medicine: string; date: string; evidence: string };
export const QUEUE_FLEA_IDS: FleaFieldIds = { medicine: "flea-medicine", date: "flea-date", evidence: "flea-evidence" };

/** ข้อความ + ช่องที่ต้องชี้ ของข้อผิดพลาดจากตัวตรวจคำตอบเรื่องยา */
export function declarationError(
  error: FleaDeclarationError,
  stored: FleaPetData,
  t: T,
  ids: FleaFieldIds = QUEUE_FLEA_IDS
): FieldError {
  switch (error) {
    case "MEDICINE":
      return { id: ids.medicine, message: t.liffBook.requiredField(t.liffBook.fleaMedicine) };
    case "DATE":
      return { id: ids.date, message: t.liffBook.requiredField(t.liffBook.fleaDate) };
    case "DATE_FUTURE":
      return { id: ids.date, message: t.liffBook.fleaDateFuture };
    case "DATE_BEFORE_BIRTH":
      return { id: ids.date, message: t.liffBook.fleaDateBeforeBirth };
    case "DATE_UNCHANGED":
      return { id: ids.date, message: t.liffBook.fleaDateUnchanged };
    case "DATE_NOT_NEWER":
      return { id: ids.date, message: t.liffBook.fleaDateNotNewer(stored.givenAt ? dayLabel(stored.givenAt) : "-") };
    case "EVIDENCE":
      return { id: ids.evidence, message: t.liffBook.fleaEvidenceRequired };
  }
}
