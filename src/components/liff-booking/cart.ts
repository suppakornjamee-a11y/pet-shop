import { addDaysThai, daysBetween } from "@/lib/slots";
import {
  BATH_DEPOSIT_AMOUNT,
  CCTV_ROOM_RATE,
  NANNY_REGULAR_RATE,
  NANNY_VIP_RATE,
  todayStr,
  type Kind,
  type Room,
  type Service,
  type Species,
} from "./shared";

/** ข้อมูลที่ลูกค้ากำลังกรอกของรายการหนึ่ง (สัตว์ 1 ตัว × บริการ 1 ประเภท) */
export type ItemDraft = {
  kind: Kind;
  petId: string;
  serviceIds: string[];
  /** ติ๊กบริการฟรีให้แล้วหรือยัง — ติ๊กครั้งเดียวตอนเริ่มรายการใหม่ แก้รายการเดิมไม่ติ๊กซ้ำ */
  defaultsApplied: boolean;
  date: string;
  time: string;
  roomId: string;
  checkInTime: string;
  checkOutDate: string;
  checkOutTime: string;
  nannyType: "NONE" | "REGULAR" | "VIP";
  cctvRequested: boolean;
  note: string;
  styleNote: string;
  styleImages: string[];
  /** ที่มาของข้อมูลสัตว์เลี้ยงในรายการนี้ (ยืนยันข้อมูลเดิม / อัปเดต / กรอกใหม่) — ส่งไปจดลงประวัติออเดอร์ */
  petInfo: "" | "NEW" | "SAME" | "UPDATED";
};

export function newItemDraft(kind: Kind, petId: string): ItemDraft {
  const today = todayStr();
  return {
    kind,
    petId,
    serviceIds: [],
    defaultsApplied: false,
    date: today,
    time: "",
    roomId: "",
    checkInTime: "13:00",
    checkOutDate: addDaysThai(today, 1),
    checkOutTime: "11:00",
    nannyType: "NONE",
    cctvRequested: false,
    note: "",
    styleNote: "",
    styleImages: [],
    petInfo: "",
  };
}

/** รายการในตะกร้า — เก็บข้อมูลที่ต้องส่งให้ server + ชื่อ/ยอดไว้แสดงผล (ราคาจริงคำนวณที่ server อีกครั้ง) */
export type CartEntry = {
  key: string;
  draft: ItemDraft;
  petName: string;
  species: Species;
  serviceNames: string[];
  roomLabel: string | null;
  nights: number;
  estimate: number;
  deposit: number;
  dueNow: number;
};

export function forSpecies(services: Service[], species: Species | undefined): Service[] {
  return services.filter((s) => !s.speciesScope || !species || s.speciesScope === species);
}

/** แยกบริการอาบน้ำเป็นกลุ่มตามหน้าจอ: อาบน้ำหลัก (ต้องเลือก 1) / ตัดขน (ไม่บังคับ) / บริการเสริม / บริการฟรี */
export function bathGroups(services: Service[]) {
  const byPrice = (a: Service, b: Service) => a.price - b.price;
  return {
    main: services.filter((s) => s.category === "BATH" && !s.group && !s.defaultOn).sort(byPrice),
    groom: services.filter((s) => s.category === "GROOMING" && !s.defaultOn).sort(byPrice),
    addons: services.filter((s) => s.category === "BATH" && !!s.group && !s.defaultOn).sort(byPrice),
    free: services.filter((s) => s.defaultOn).sort(byPrice),
  };
}

export function stayNights(draft: ItemDraft, room: Room | null): number {
  if (!room) return 0;
  const perVisit = room.category.billingUnit === "PER_VISIT";
  // ห้องรายครั้งจองข้ามวันคิดเหมือนห้องรายคืน — ตรงกับที่ server คำนวณใน buildOrderPlan
  return !perVisit || draft.date !== draft.checkOutDate ? Math.max(1, daysBetween(draft.date, draft.checkOutDate)) : 0;
}

export function estimateDraft(draft: ItemDraft, services: Service[], rooms: Room[]) {
  // เรียงชื่อตามที่ลูกค้าเห็นบนหน้าจอ: บริการหลัก → ตัดขน → บริการเสริม → บริการฟรี
  const rank = (s: Service) => (s.defaultOn ? 3 : s.category === "GROOMING" ? 1 : s.group ? 2 : 0);
  const chosen = services.filter((s) => draft.serviceIds.includes(s.id)).sort((a, b) => rank(a) - rank(b));
  let estimate = chosen.reduce((sum, s) => sum + s.price, 0);
  const room = draft.kind === "BOARDING" ? (rooms.find((r) => r.id === draft.roomId) ?? null) : null;
  const nights = stayNights(draft, room);
  if (room) {
    estimate += room.pricePerNight * (nights > 0 ? nights : 1);
    if (draft.nannyType === "REGULAR") estimate += NANNY_REGULAR_RATE * (nights > 0 ? nights : 1);
    if (draft.nannyType === "VIP") estimate += NANNY_VIP_RATE;
    if (draft.cctvRequested) estimate += CCTV_ROOM_RATE;
  }
  const deposit = draft.kind === "BATH" ? Math.min(BATH_DEPOSIT_AMOUNT, estimate) : 0;
  return {
    estimate,
    deposit,
    dueNow: deposit > 0 ? deposit : estimate,
    nights,
    room,
    serviceNames: chosen.map((s) => s.name),
  };
}

/** แปลงเป็นข้อมูลที่ liffSubmitBookingRequest รับ (ตรงกับ cartItemSchema) */
export function entryToPayload(e: CartEntry) {
  const d = e.draft;
  const boarding = d.kind === "BOARDING";
  return {
    petId: d.petId,
    kind: d.kind,
    serviceIds: d.serviceIds,
    appointmentDate: boarding ? undefined : d.date,
    appointmentTime: boarding ? undefined : d.time,
    roomId: boarding ? d.roomId : null,
    checkInDate: boarding ? d.date : undefined,
    checkInTime: boarding ? d.checkInTime : undefined,
    checkOutDate: boarding ? d.checkOutDate : undefined,
    checkOutTime: boarding ? d.checkOutTime : undefined,
    nannyType: boarding ? d.nannyType : "NONE",
    cctvRequested: boarding ? d.cctvRequested : false,
    note: d.note || undefined,
    groomingStyleNote: d.kind === "BATH" ? d.styleNote || undefined : undefined,
    groomingStyleImages: d.kind === "BATH" ? d.styleImages : [],
    petInfo: d.kind === "BATH" && d.petInfo ? d.petInfo : undefined,
  };
}

/* ---------- เก็บตะกร้าไว้ในเครื่อง (ปิดแอปแล้วเปิดใหม่ยังอยู่) ---------- */

const CART_KEY = "liff-booking-cart-v1";

export function loadCart(customerId: string): CartEntry[] {
  try {
    const raw = localStorage.getItem(CART_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as { customerId: string; entries: CartEntry[] };
    // เครื่องเดียวกันแต่คนละบัญชี LINE — ไม่เอาตะกร้าของอีกคนมาแสดง
    return parsed.customerId === customerId && Array.isArray(parsed.entries) ? parsed.entries : [];
  } catch {
    return [];
  }
}

export function saveCart(customerId: string, entries: CartEntry[]) {
  try {
    if (entries.length === 0) localStorage.removeItem(CART_KEY);
    else localStorage.setItem(CART_KEY, JSON.stringify({ customerId, entries }));
  } catch {
    // พื้นที่เต็ม/ถูกปิดไว้ — ตะกร้ายังใช้ได้ในหน้านี้ แค่ไม่คงอยู่หลังปิดแอป
  }
}
