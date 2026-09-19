import type { Prisma } from "@/generated/prisma/client";
import { petCreateData, type PetInput } from "@/lib/customer-schema";

type Db = Prisma.TransactionClient;

/** รหัสยาที่ส่งมาจากฟอร์มต้องมีอยู่จริงและยังใช้งาน — ไม่งั้นทิ้งเป็น null (เก็บไว้แค่ข้อความที่พิมพ์) */
async function validProductId(db: Db, id: string | null | undefined): Promise<string | null> {
  if (!id) return null;
  const found = await db.fleaTickProduct.findFirst({ where: { id, active: true }, select: { id: true } });
  return found?.id ?? null;
}

/** ข้อมูลสร้างสัตว์เลี้ยงใหม่ — สถานะแหล่งข้อมูลยาเห็บหมัดเริ่มที่ "ลูกค้าแจ้ง" เสมอ (ค่าเริ่มต้นของตาราง) */
export async function petCreateInput(db: Db, p: PetInput) {
  return { ...petCreateData(p), fleaTickProductId: await validProductId(db, p.fleaTickProductId) };
}

/**
 * ข้อมูลแก้ไขสัตว์เลี้ยง — ถ้าข้อมูลยาเห็บหมัดเปลี่ยน (ชื่อที่พิมพ์ / วันที่ให้ยา / ยาที่จับคู่ / หลักฐาน)
 * สถานะ "พนักงานตรวจหลักฐานแล้ว" ต้องหลุดกลับเป็น "ลูกค้าแจ้ง" เพราะสิ่งที่ตรวจไว้ไม่ใช่ข้อมูลชุดนี้แล้ว
 * ถ้าไม่เปลี่ยน (เช่นแก้แค่นิสัย) คงสถานะเดิมไว้ ไม่ให้การแก้เรื่องอื่นล้างผลตรวจทิ้ง
 */
export async function petUpdateInput(db: Db, petId: string, p: PetInput) {
  const next = await petCreateInput(db, p);
  const prev = await db.pet.findUnique({
    where: { id: petId },
    select: { fleaTickMedicine: true, lastFleaTickAt: true, fleaTickProductId: true, fleaTickEvidenceUrls: true },
  });
  const changed =
    !prev ||
    (prev.fleaTickMedicine ?? null) !== next.fleaTickMedicine ||
    (prev.lastFleaTickAt?.getTime() ?? null) !== (next.lastFleaTickAt?.getTime() ?? null) ||
    prev.fleaTickProductId !== next.fleaTickProductId ||
    prev.fleaTickEvidenceUrls.join("\n") !== next.fleaTickEvidenceUrls.join("\n");
  return changed
    ? { ...next, fleaTickSource: "CUSTOMER" as const, fleaTickCheckedById: null, fleaTickCheckedAt: null }
    : next;
}
