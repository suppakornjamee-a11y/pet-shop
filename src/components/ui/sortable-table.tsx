"use client";

import { useMemo, useState } from "react";
import { ArrowDown, ArrowUp, ChevronsUpDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { TableHead } from "@/components/ui/table";

export type SortDirection = "asc" | "desc";
export type SortValue = string | number | null | undefined;

/**
 * เรียงลำดับตารางแบบใช้ร่วมกันทุกหน้าที่มี data table (ประวัติลูกค้า / ผู้ใช้งาน / รายการอาหาร-สินค้า)
 * รวมไว้ที่เดียวเพื่อให้ทุกตารางเรียงเหมือนกัน — โดยเฉพาะภาษาไทยที่ต้องใช้ localeCompare("th")
 * ไม่งั้นจะเรียงตามรหัสตัวอักษรแล้วลำดับเพี้ยน
 */
export function useTableSort<T>(
  rows: T[],
  accessors: Record<string, (row: T) => SortValue>,
  initial?: { key: string; direction?: SortDirection }
) {
  const [key, setKey] = useState<string | null>(initial?.key ?? null);
  const [direction, setDirection] = useState<SortDirection>(initial?.direction ?? "asc");

  const sorted = useMemo(() => {
    const get = key ? accessors[key] : undefined;
    if (!get) return rows;
    const factor = direction === "asc" ? 1 : -1;
    return [...rows].sort((a, b) => {
      const av = get(a);
      const bv = get(b);
      // ค่าว่างไปท้ายเสมอ ไม่ว่าจะเรียงขึ้นหรือลง
      if (av == null && bv == null) return 0;
      if (av == null) return 1;
      if (bv == null) return -1;
      if (typeof av === "number" && typeof bv === "number") return (av - bv) * factor;
      return String(av).localeCompare(String(bv), "th") * factor;
    });
  }, [rows, key, direction, accessors]);

  function toggle(nextKey: string) {
    if (key === nextKey) {
      setDirection((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setKey(nextKey);
      setDirection("asc");
    }
  }

  return { sorted, key, direction, toggle };
}

/** หัวคอลัมน์ที่กดเรียงได้ — ไอคอนบอกทิศทางปัจจุบัน */
export function SortableHead({
  sortKey,
  sort,
  className,
  children,
}: {
  sortKey: string;
  sort: { key: string | null; direction: SortDirection; toggle: (key: string) => void };
  className?: string;
  children: React.ReactNode;
}) {
  const active = sort.key === sortKey;
  const Icon = !active ? ChevronsUpDown : sort.direction === "asc" ? ArrowUp : ArrowDown;

  return (
    <TableHead className={cn("px-4 text-left font-medium text-muted-foreground", className)}>
      <button
        type="button"
        onClick={() => sort.toggle(sortKey)}
        className={cn(
          "inline-flex items-center justify-center gap-1 transition-colors hover:text-foreground",
          active && "text-foreground"
        )}
      >
        {children}
        <Icon className={cn("h-3.5 w-3.5", active ? "opacity-100" : "opacity-40")} />
      </button>
    </TableHead>
  );
}
