"use client";

import { useMemo, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { useI18n } from "@/components/i18n-provider";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export const PAGE_SIZES = [5, 10, 20, 50, 100] as const;

/** แบ่งหน้าตาราง — ใช้ร่วมกันทุกหน้าที่มี data table ให้จำนวนต่อหน้าและปุ่มเลื่อนเหมือนกันหมด */
export function useTablePagination<T>(rows: T[], initialSize: number = 10) {
  const [pageSize, setPageSize] = useState(initialSize);
  const [page, setPage] = useState(1);

  const totalPages = Math.max(1, Math.ceil(rows.length / pageSize));

  // ข้อมูลเปลี่ยน (ค้นหา/กรอง/เรียงใหม่) แล้วหน้าที่ค้างอยู่อาจเกินจำนวนหน้าที่มี
  // จำกัดตอนคำนวณเลยแทนที่จะ setState ใน effect — ไม่ต้องเรนเดอร์ซ้ำและไม่มีจังหวะที่ตารางว่างแวบนึง
  const currentPage = Math.min(page, totalPages);

  const paged = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return rows.slice(start, start + pageSize);
  }, [rows, currentPage, pageSize]);

  function changePageSize(size: number) {
    setPageSize(size);
    setPage(1);
  }

  return { paged, page: currentPage, setPage, pageSize, changePageSize, totalPages, total: rows.length };
}

export type TablePaginationState = ReturnType<typeof useTablePagination>;

export function TablePagination({
  state,
}: {
  state: {
    page: number;
    setPage: (p: number) => void;
    pageSize: number;
    changePageSize: (n: number) => void;
    totalPages: number;
    total: number;
  };
}) {
  const { t } = useI18n();
  const { page, setPage, pageSize, changePageSize, totalPages, total } = state;

  const from = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const to = Math.min(page * pageSize, total);

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 text-sm">
      <div className="flex items-center gap-2">
        <span className="text-muted-foreground">{t.common.rowsPerPage}</span>
        <Select
          value={String(pageSize)}
          onValueChange={(v) => changePageSize(Number(v ?? pageSize))}
          items={Object.fromEntries(PAGE_SIZES.map((n) => [String(n), String(n)]))}
        >
          <SelectTrigger className="w-[72px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {PAGE_SIZES.map((n) => (
              <SelectItem key={n} value={String(n)}>
                {n}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="flex items-center gap-2">
        <span className="text-muted-foreground tabular-nums">
          {t.common.pageRange(from, to, total)}
        </span>
        <Button
          variant="outline"
          size="icon-sm"
          aria-label={t.common.previousPage}
          disabled={page <= 1}
          onClick={() => setPage(page - 1)}
        >
          <ChevronLeft />
        </Button>
        <Button
          variant="outline"
          size="icon-sm"
          aria-label={t.common.nextPage}
          disabled={page >= totalPages}
          onClick={() => setPage(page + 1)}
        >
          <ChevronRight />
        </Button>
      </div>
    </div>
  );
}
