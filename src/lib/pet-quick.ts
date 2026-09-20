import { z } from "zod";
import type { Prisma } from "@/generated/prisma/client";
import { isValidDateStr, toThaiDateStr } from "@/lib/slots";

type Db = Prisma.TransactionClient;

/**
 * ฟอร์มข้อมูลสัตว์เลี้ยงแบบสั้นของหน้าจองใน LINE (อาบน้ำ/กรูมมิ่ง) — เก็บเฉพาะที่ร้านต้องรู้ก่อนรับงาน
 * แก้ไขได้เฉพาะช่องเหล่านี้ ช่องอื่นของสัตว์เลี้ยง (รูป สมุดวัคซีน ฯลฯ) ไม่ถูกแตะ
 */
export const quickPetSchema = z
  .object({
    id: z.string().optional(),
    name: z.string().trim().min(1, "กรุณากรอกชื่อสัตว์เลี้ยง"),
    species: z.enum(["DOG", "CAT"]),
    breed: z.string().trim().min(1, "กรุณากรอกพันธุ์"),
    birthDate: z.string().refine(isValidDateStr, "กรุณาเลือกวันเกิด"),
    weightKg: z.coerce.number().gt(0, "กรุณากรอกน้ำหนัก"),
    allergies: z.string().trim().min(1, "กรุณากรอกอาการแพ้หรือความไวต่อสิ่งกระตุ้น (ถ้าไม่มีให้พิมพ์ ไม่มี)"),
    groomingCautions: z.string().trim().min(1, "กรุณากรอกข้อควรระวังระหว่างกรูมมิ่ง (ถ้าไม่มีให้พิมพ์ ไม่มี)"),
    hasChronicDisease: z.boolean({ message: "กรุณาเลือกว่ามีโรคประจำตัวหรือไม่" }),
    chronicDiseaseNote: z.string().trim().optional(),
    fleaTickMedicine: z.string().trim().optional(),
    fleaTickProductId: z.string().nullable().optional(),
    lastFleaTickDate: z
      .string()
      .optional()
      .refine((v) => !v || !isValidDateStr(v) || v <= toThaiDateStr(new Date()), {
        message: "วันที่ใช้ยาเห็บหมัดต้องไม่เป็นวันในอนาคต",
      }),
  })
  .refine((p) => !p.hasChronicDisease || !!p.chronicDiseaseNote, {
    message: "กรุณาระบุรายละเอียดโรคประจำตัว",
  });
export type QuickPetInput = z.infer<typeof quickPetSchema>;

export const fleaTickUpdateSchema = z.object({
  fleaTickMedicine: z.string().trim().optional(),
  fleaTickProductId: z.string().nullable().optional(),
  lastFleaTickDate: z
    .string()
    .optional()
    .refine((v) => !v || !isValidDateStr(v) || v <= toThaiDateStr(new Date()), {
      message: "วันที่ใช้ยาเห็บหมัดต้องไม่เป็นวันในอนาคต",
    }),
  fleaTickEvidenceUrls: z.array(z.string()).max(3).optional(),
});
export type FleaTickUpdateInput = z.infer<typeof fleaTickUpdateSchema>;

async function validProductId(db: Db, id: string | null | undefined): Promise<string | null> {
  if (!id) return null;
  const found = await db.fleaTickProduct.findFirst({ where: { id, active: true }, select: { id: true } });
  return found?.id ?? null;
}

/** ข้อมูลยาเห็บหมัดชุดใหม่ + ล้างสถานะ "ตรวจหลักฐานแล้ว" ถ้าข้อมูลเปลี่ยน (สิ่งที่ตรวจไว้ไม่ใช่ข้อมูลชุดนี้แล้ว) */
export async function fleaTickWriteData(db: Db, petId: string | null, input: FleaTickUpdateInput) {
  const next = {
    fleaTickMedicine: input.fleaTickMedicine?.trim() || null,
    fleaTickProductId: await validProductId(db, input.fleaTickProductId),
    lastFleaTickAt: input.lastFleaTickDate ? new Date(input.lastFleaTickDate) : null,
    ...(input.fleaTickEvidenceUrls ? { fleaTickEvidenceUrls: input.fleaTickEvidenceUrls } : {}),
  };
  const prev = petId
    ? await db.pet.findUnique({
        where: { id: petId },
        select: { fleaTickMedicine: true, lastFleaTickAt: true, fleaTickProductId: true, fleaTickEvidenceUrls: true },
      })
    : null;
  const changed =
    !prev ||
    prev.fleaTickMedicine !== next.fleaTickMedicine ||
    (prev.lastFleaTickAt?.getTime() ?? null) !== (next.lastFleaTickAt?.getTime() ?? null) ||
    prev.fleaTickProductId !== next.fleaTickProductId ||
    (input.fleaTickEvidenceUrls !== undefined &&
      prev.fleaTickEvidenceUrls.join("\n") !== input.fleaTickEvidenceUrls.join("\n"));
  return changed
    ? { ...next, fleaTickSource: "CUSTOMER" as const, fleaTickCheckedById: null, fleaTickCheckedAt: null }
    : next;
}

/** ช่องที่ฟอร์มสั้นเขียนลงสัตว์เลี้ยง (ใช้ทั้งสร้างใหม่และแก้ไข) */
export async function quickPetWriteData(db: Db, p: QuickPetInput) {
  return {
    name: p.name,
    species: p.species,
    breed: p.breed,
    birthDate: new Date(p.birthDate),
    weightKg: p.weightKg,
    allergies: p.allergies,
    groomingCautions: p.groomingCautions,
    hasChronicDisease: p.hasChronicDisease,
    chronicDiseaseNote: p.hasChronicDisease ? p.chronicDiseaseNote || null : null,
    // สัตว์เดิมไม่แตะข้อมูลยาเห็บหมัดที่ฟอร์มนี้ — แก้ได้ผ่านขั้นตรวจยาตอนจอง (ต้องมีหลักฐาน) เท่านั้น
    ...(p.id ? {} : await fleaTickWriteData(db, null, p)),
  };
}
