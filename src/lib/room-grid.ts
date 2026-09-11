import type { OrderStatus, BillingUnit, Species, NannyType } from "@/generated/prisma/enums";
import { thaiDayRange } from "@/lib/slots";

export type GridBooking = {
  orderId: string;
  status: OrderStatus;
  customerName: string;
  petName: string | null;
  petBreed: string | null;
  petSpecies: Species | null;
  checkInAt: Date;
  checkOutAt: Date;
  nannyType: NannyType;
  depositAmount: number;
  vaccineComplete: boolean;
  lastFleaTickAt: Date | null;
  fleaTickMedicine: string | null;
};

export type GridRoom = {
  id: string;
  name: string;
  sortOrder: number;
  categoryId: string;
  categoryName: string;
  categorySortOrder: number;
  billingUnit: BillingUnit;
};

export type RowSegment =
  | { kind: "empty"; dateStr: string }
  | {
      kind: "booking";
      startDateStr: string;
      days: number;
      continuesFromBefore: boolean;
      continuesAfter: boolean;
      booking: GridBooking;
    };

/**
 * แถวย่อยของห้องหนึ่งห้อง — หนึ่ง lane = การจองที่ไม่ทับเวลากันหนึ่งชุด วางเป็นแถบยาวแถวเดียว
 * ห้องที่มีจองทับช่วงกันจะได้หลาย lane ซ้อนกัน และ lane สุดท้ายเป็นแถวว่างเสมอ
 * เพื่อให้ยังมีปุ่ม + เพิ่มคิวในวันที่มีคนจองอยู่แล้วได้
 */
export type GridRow = { room: GridRoom; lanes: RowSegment[][] };
export type GridSection = { categoryId: string; categoryName: string; rows: GridRow[] };

/**
 * จัดวางการจองลงตาราง room × date เป็นแถวต่อห้อง คอลัมน์ต่อวัน
 * การจองที่ข้ามหลายวันจะรวมเป็น segment เดียว (ใช้เป็น colSpan ได้ตรงๆ)
 *
 * ห้องหนึ่งห้องอาจมีจองทับช่วงเวลากันได้ (ร้านรับเพิ่มได้อีกในวันเดียวกัน) จึงแยกเป็น lane
 * โดยไล่จัดการจองลง lane แรกที่ยังไม่ชนกัน — ถ้าเก็บแค่การจองแรกของวันแบบเดิม ใบที่สอง
 * จะหายไปจากตารางทั้งที่มีอยู่จริงในระบบ
 */
type DayRange = { dateStr: string; start: Date; end: Date };

/** ปูการจองของ lane เดียวลงช่องวัน — การจองข้ามวันรวมเป็น segment เดียวเพื่อใช้เป็น colSpan */
function buildLaneSegments(
  laneBookings: GridBooking[],
  dayRanges: DayRange[]
): RowSegment[] {
  const segments: RowSegment[] = [];
  let i = 0;
  while (i < dayRanges.length) {
    const day = dayRanges[i];
    const booking = laneBookings.find((b) => b.checkInAt < day.end && b.checkOutAt > day.start);
    if (!booking) {
      segments.push({ kind: "empty", dateStr: day.dateStr });
      i += 1;
      continue;
    }
    let days = 0;
    while (i + days < dayRanges.length) {
      const d = dayRanges[i + days];
      if (booking.checkInAt < d.end && booking.checkOutAt > d.start) days += 1;
      else break;
    }
    segments.push({
      kind: "booking",
      startDateStr: day.dateStr,
      days,
      continuesFromBefore: booking.checkInAt < day.start,
      continuesAfter: booking.checkOutAt > dayRanges[i + days - 1].end,
      booking,
    });
    i += days;
  }
  return segments;
}

export function buildRoomGrid(
  rooms: GridRoom[],
  bookings: (GridBooking & { roomId: string })[],
  dateRange: string[]
): GridSection[] {
  const byRoom = new Map<string, (GridBooking & { roomId: string })[]>();
  for (const b of bookings) {
    const list = byRoom.get(b.roomId) ?? [];
    list.push(b);
    byRoom.set(b.roomId, list);
  }

  const sortedRooms = [...rooms].sort(
    (a, b) => a.categorySortOrder - b.categorySortOrder || a.sortOrder - b.sortOrder
  );

  const dayRanges = dateRange.map((d) => ({ dateStr: d, ...thaiDayRange(d) }));

  const sections = new Map<string, GridSection>();
  for (const room of sortedRooms) {
    const roomBookings = (byRoom.get(room.id) ?? []).sort(
      (a, b) => a.checkInAt.getTime() - b.checkInAt.getTime()
    );

    // แบ่งการจองลง lane แบบ greedy — ใบไหนชนกับใบที่อยู่ใน lane นั้นแล้วก็เลื่อนไป lane ถัดไป
    const laneBookings: (GridBooking & { roomId: string })[][] = [];
    for (const b of roomBookings) {
      const lane = laneBookings.find(
        (ls) => !ls.some((o) => b.checkInAt < o.checkOutAt && b.checkOutAt > o.checkInAt)
      );
      if (lane) lane.push(b);
      else laneBookings.push([b]);
    }

    const lanes = laneBookings.map((ls) => buildLaneSegments(ls, dayRanges));
    // แถวว่างท้ายสุดเสมอ — ไว้ให้กด + เพิ่มคิวได้ทุกวัน แม้วันนั้นจะมีคนจองอยู่แล้ว
    lanes.push(dayRanges.map((d) => ({ kind: "empty" as const, dateStr: d.dateStr })));

    const section = sections.get(room.categoryId) ?? {
      categoryId: room.categoryId,
      categoryName: room.categoryName,
      rows: [],
    };
    section.rows.push({ room, lanes });
    sections.set(room.categoryId, section);
  }

  return [...sections.values()];
}

/** นับจำนวนสุนัข/แมวที่เข้าพักอยู่ในแต่ละวัน (ใช้แสดงตัวเลขเล็กๆ ใต้หัวคอลัมน์วันที่) */
export function countSpeciesByDate(
  bookings: GridBooking[],
  dateRange: string[]
): Record<string, { dog: number; cat: number }> {
  const dayRanges = dateRange.map((d) => ({ dateStr: d, ...thaiDayRange(d) }));
  const counts: Record<string, { dog: number; cat: number }> = {};
  for (const day of dayRanges) {
    let dog = 0;
    let cat = 0;
    for (const b of bookings) {
      if (b.checkInAt < day.end && b.checkOutAt > day.start) {
        if (b.petSpecies === "DOG") dog += 1;
        else if (b.petSpecies === "CAT") cat += 1;
      }
    }
    counts[day.dateStr] = { dog, cat };
  }
  return counts;
}
