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

export type GridRow = { room: GridRoom; segments: RowSegment[] };
export type GridSection = { categoryId: string; categoryName: string; rows: GridRow[] };

/**
 * จัดวางการจองลงตาราง room × date เป็นแถวต่อห้อง คอลัมน์ต่อวัน
 * การจองที่ข้ามหลายวันจะรวมเป็น segment เดียว (ใช้เป็น colSpan ได้ตรงๆ)
 */
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

    const segments: RowSegment[] = [];
    let i = 0;
    while (i < dayRanges.length) {
      const day = dayRanges[i];
      const booking = roomBookings.find(
        (b) => b.checkInAt < day.end && b.checkOutAt > day.start
      );
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
      const continuesFromBefore = booking.checkInAt < day.start;
      const continuesAfter = booking.checkOutAt > dayRanges[i + days - 1].end;
      segments.push({
        kind: "booking",
        startDateStr: day.dateStr,
        days,
        continuesFromBefore,
        continuesAfter,
        booking,
      });
      i += days;
    }

    const section = sections.get(room.categoryId) ?? {
      categoryId: room.categoryId,
      categoryName: room.categoryName,
      rows: [],
    };
    section.rows.push({ room, segments });
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
