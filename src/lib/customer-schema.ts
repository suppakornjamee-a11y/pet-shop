import { z } from "zod";

export const petSchema = z.object({
  name: z.string().min(1, "กรุณากรอกชื่อสัตว์เลี้ยง"),
  species: z.enum(["DOG", "CAT"]),
  breed: z.string().optional(),
  gender: z.enum(["MALE", "FEMALE", "UNKNOWN"]).default("UNKNOWN"),
  birthDate: z.string().optional(),
  weightKg: z.coerce.number().optional(),
  color: z.string().optional(),
  personality: z.string().optional(),
  aggressiveNotes: z.string().optional(),
  allergies: z.string().optional(),
  vaccine5in1Date: z.string().optional(),
  rabiesVaccineDate: z.string().optional(),
  lastFleaTickDate: z.string().optional(),
  fleaTickMedicine: z.string().optional(),
  foodNote: z.string().optional(),
  medicationNote: z.string().optional(),
  neutered: z.coerce.boolean().default(false),
  note: z.string().optional(),
  photoUrls: z.array(z.string()).default([]),
  vaccinePhotoUrls: z.array(z.string()).default([]),
  vaccineComplete: z.coerce.boolean().default(false),
});

// ใช้เฉพาะหน้าลงทะเบียนสัตว์เลี้ยง (RegisterForm — ทั้งฝั่งพนักงานและฝั่งลูกค้าเองผ่าน LINE)
// บังคับกรอกครบเกือบทุกฟิลด์ ยกเว้นหมายเหตุ และวันที่ฉีดวัคซีน/เห็บหมัด (ไม่บังคับตามคำขอ — อาจยังไม่เคยพาไปฉีด)
export const petRegisterSchema = petSchema.extend({
  breed: z.string().min(1, "กรุณากรอกพันธุ์"),
  birthDate: z.string().min(1, "กรุณาเลือกวันเกิดสัตว์เลี้ยง"),
  weightKg: z.coerce.number().gt(0, "กรุณากรอกน้ำหนัก"),
  color: z.string().min(1, "กรุณากรอกสี"),
  personality: z.string().min(1, "กรุณากรอกนิสัย"),
  aggressiveNotes: z.string().min(1, "กรุณากรอกข้อควรระวังด้านความก้าวร้าว"),
  allergies: z.string().min(1, "กรุณากรอกอาการแพ้หรือปัญหาสุขภาพ"),
  foodNote: z.string().min(1, "กรุณากรอกรายละเอียดการให้อาหาร"),
  medicationNote: z.string().min(1, "กรุณากรอกรายละเอียดการให้ยา"),
  photoUrls: z.array(z.string()).min(1, "กรุณาแนบรูปสัตว์เลี้ยงอย่างน้อย 1 รูป"),
  vaccinePhotoUrls: z.array(z.string()).min(1, "กรุณาแนบรูปสมุดวัคซีนอย่างน้อย 1 รูป"),
});

export function petCreateData(p: z.infer<typeof petSchema>) {
  return {
    name: p.name,
    species: p.species,
    gender: p.gender,
    breed: p.breed || null,
    color: p.color || null,
    weightKg: p.weightKg ?? null,
    birthDate: p.birthDate ? new Date(p.birthDate) : null,
    allergies: p.allergies || null,
    note: p.note || null,
    personality: p.personality || null,
    aggressiveNotes: p.aggressiveNotes || null,
    foodNote: p.foodNote || null,
    medicationNote: p.medicationNote || null,
    neutered: p.neutered,
    photoUrls: p.photoUrls,
    vaccinePhotoUrls: p.vaccinePhotoUrls,
    vaccineComplete: p.vaccineComplete,
    vaccine5in1At: p.vaccine5in1Date ? new Date(p.vaccine5in1Date) : null,
    rabiesVaccineAt: p.rabiesVaccineDate ? new Date(p.rabiesVaccineDate) : null,
    lastFleaTickAt: p.lastFleaTickDate ? new Date(p.lastFleaTickDate) : null,
    fleaTickMedicine: p.fleaTickMedicine || null,
  };
}

export const customerSchema = z.object({
  name: z.string().min(1, "กรุณากรอกชื่อเจ้าของ"),
  nickname: z.string().optional(),
  phone: z.string().min(6, "กรุณากรอกเบอร์โทร"),
  email: z.string().optional(),
  lineId: z.string().optional(),
  address: z.string().optional(),
  petInstagram: z.string().optional(),
  preferredLanguage: z.enum(["TH", "EN"]).default("TH"),
  note: z.string().optional(),
});
