import { prisma } from "@/lib/prisma";

export async function getSetting(key: string, fallback = ""): Promise<string> {
  const s = await prisma.setting.findUnique({ where: { key } });
  return s?.value ?? fallback;
}

/** คีย์ที่ใช้เก็บข้อมูลร้านในตาราง Setting (key-value ทั่วไป) — ใช้แสดงบนใบเสร็จและ Rich Menu */
export const SHOP_INFO_KEYS = {
  name: "shop_name",
  address: "shop_address",
  taxId: "shop_tax_id",
  lineId: "shop_line_id",
  phone: "shop_phone",
  hours: "shop_hours",
} as const;

export async function getShopInfo() {
  const [name, address, taxId, lineId, phone, hours] = await Promise.all([
    getSetting(SHOP_INFO_KEYS.name, "Pawsome Space"),
    getSetting(SHOP_INFO_KEYS.address),
    getSetting(SHOP_INFO_KEYS.taxId),
    getSetting(SHOP_INFO_KEYS.lineId),
    getSetting(SHOP_INFO_KEYS.phone),
    getSetting(SHOP_INFO_KEYS.hours),
  ]);
  return { name, address, taxId, lineId, phone, hours };
}
