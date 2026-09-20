"use client";

import { useEffect, useId, useMemo, useRef, useState } from "react";
import { matchMedicine, type FleaTickProductInfo, type Species } from "@/lib/flea-tick";
import { cn } from "@/lib/utils";
import { useI18n } from "@/components/i18n-provider";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

const LIFF_FIELD = "h-11 rounded-xl bg-card";
const INVALID = "border-destructive focus-visible:border-destructive focus-visible:ring-destructive/40";

/** ยานี้ใช้กับสัตว์ชนิดนี้ได้ไหม (ยาที่ไม่ระบุชนิดใช้ได้ทั้งหมาและแมว) */
export function fitsSpecies(product: Pick<FleaTickProductInfo, "species">, species: Species): boolean {
  return !product.species || product.species === species;
}

/**
 * ช่องกรอกชื่อยาเห็บหมัดแบบ autocomplete — พิมพ์แล้วรายการแสดงตามที่พิมพ์ (ช่องว่างไม่แสดงอะไร)
 * พิมพ์แค่ส่วนแรกของชื่อ ชื่อไทย หรือสะกดผิดเล็กน้อยก็เจอ เลือกด้วยการกดหรือใช้ลูกศร + Enter ก็ได้
 * รายการแสดงเฉพาะชื่อยา (บรรทัดเดียว) และกรองตามชนิดสัตว์ "ตอนนี้" ของฟอร์มเสมอ (เปลี่ยนชนิดสัตว์รายการเปลี่ยนตาม)
 *
 * รายการลอยทับเนื้อหาใต้ช่อง (ไม่ดันหน้า) และเลื่อนหน้าให้เห็นเองเมื่อเปิด — บนมือถือรายการที่แสดงต่อท้ายช่องในหน้า
 * มักไปซ่อนอยู่หลังคีย์บอร์ดหรือปุ่มที่แปะด้านล่างจอ
 *
 * เลือกแล้ว: ข้อความที่พิมพ์ไว้หายไป ช่องกลายเป็นชื่อยาที่เลือก (กด "เปลี่ยน" เพื่อเลือกใหม่) — ไม่เลือกให้เองเด็ดขาด
 * ชื่อเต็มของยาที่เลือกยังถูกเก็บไว้ในข้อมูลด้วย (fleaTickMedicine) เพื่อให้หน้าอื่นที่โชว์แค่ข้อความยังอ่านได้
 */
export function MedicineNameField({
  value,
  productId,
  species,
  catalog,
  onChange,
  inputId,
  invalid = false,
  readOnly = false,
  showNoMatchHint = false,
  inputClassName,
}: {
  value: string;
  productId: string | null;
  species: Species;
  catalog: FleaTickProductInfo[];
  onChange: (patch: { fleaTickMedicine?: string; fleaTickProductId?: string | null }) => void;
  inputId?: string;
  invalid?: boolean;
  readOnly?: boolean;
  /** แสดง "ไม่พบในฐานข้อมูลยา" เมื่อพิมพ์แล้วไม่มีรายการตรง (ฟอร์มลงทะเบียนเต็มใช้) */
  showNoMatchHint?: boolean;
  /** คลาสของช่องพิมพ์ — ค่าเริ่มต้นเป็นสไตล์หน้าจอลูกค้าบน LINE */
  inputClassName?: string;
}) {
  const { t } = useI18n();
  const listId = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);

  // ยาที่เลือกไว้ต้องใช้กับสัตว์ชนิดปัจจุบันได้ — ถ้าเปลี่ยนชนิดสัตว์แล้วไม่ตรงกัน ถือว่ายังไม่ได้เลือก
  const found = catalog.find((p) => p.id === productId) ?? null;
  const selected = found && fitsSpecies(found, species) ? found : null;
  const typed = value.trim().length >= 1;

  // รายการกรองตามที่พิมพ์เท่านั้น — ยังไม่ได้พิมพ์อะไรก็ไม่แสดงรายการ
  const options = useMemo(
    () => (selected || !typed ? [] : matchMedicine(value, catalog, species).slice(0, 6).map((m) => m.product)),
    [selected, typed, value, catalog, species]
  );

  const show = open && !readOnly && options.length > 0;

  // เปิดรายการแล้วเลื่อนหน้าให้เห็นทั้งรายการ เว้นที่ด้านล่างไว้ให้ปุ่มที่แปะขอบจอ (scroll-mb ที่ตัวรายการ)
  useEffect(() => {
    if (show) listRef.current?.scrollIntoView({ block: "nearest", behavior: "smooth" });
  }, [show, options.length]);

  function pick(p: FleaTickProductInfo) {
    onChange({ fleaTickMedicine: p.name, fleaTickProductId: p.id });
    setOpen(false);
    setActive(-1);
    inputRef.current?.blur(); // ปิดคีย์บอร์ดบนมือถือ
  }

  function clear() {
    onChange({ fleaTickMedicine: "", fleaTickProductId: null });
    // ช่องพิมพ์เพิ่งกลับมาแสดง — รอให้ mount แล้วโฟกัสให้พิมพ์ต่อได้เลย
    setTimeout(() => inputRef.current?.focus(), 0);
  }

  if (selected) {
    return (
      <div
        className={cn(
          "flex min-h-11 items-center justify-between gap-2 rounded-xl border border-primary/40 bg-primary/5 py-1.5 pl-3 pr-1.5 text-sm",
          inputClassName === "" && "min-h-8 rounded-lg"
        )}
      >
        <span className="min-w-0 truncate font-medium">{selected.name}</span>
        {!readOnly && (
          <Button type="button" variant="ghost" size="sm" className="h-8 shrink-0 px-2.5 text-xs" onClick={clear}>
            {t.fleaTick.change}
          </Button>
        )}
      </div>
    );
  }

  return (
    <div className="relative space-y-1.5">
      <Input
        ref={inputRef}
        id={inputId}
        role="combobox"
        aria-expanded={show}
        aria-controls={listId}
        aria-autocomplete="list"
        autoComplete="off"
        className={cn(inputClassName ?? LIFF_FIELD, invalid && INVALID)}
        value={value}
        disabled={readOnly}
        onFocus={() => setOpen(true)}
        onBlur={() => setOpen(false)}
        onChange={(e) => {
          onChange({ fleaTickMedicine: e.target.value, fleaTickProductId: null });
          setOpen(true);
          setActive(-1);
        }}
        onKeyDown={(e) => {
          if (e.key === "ArrowDown") {
            e.preventDefault();
            setOpen(true);
            setActive((i) => Math.min(i + 1, options.length - 1));
          } else if (e.key === "ArrowUp") {
            e.preventDefault();
            setActive((i) => Math.max(i - 1, 0));
          } else if (e.key === "Enter" && show && active >= 0) {
            e.preventDefault();
            pick(options[active]);
          } else if (e.key === "Escape") {
            setOpen(false);
          }
        }}
      />

      {showNoMatchHint && !readOnly && typed && options.length === 0 && (
        <p className="text-xs text-muted-foreground">{t.fleaTick.noMatchHint}</p>
      )}

      {show && (
        <div
          ref={listRef}
          id={listId}
          role="listbox"
          className="absolute inset-x-0 top-full z-30 mt-1 max-h-64 scroll-mb-28 overflow-y-auto rounded-xl border bg-popover p-1 shadow-lg"
        >
          {options.map((p, i) => (
            <button
              key={p.id}
              type="button"
              role="option"
              aria-selected={i === active}
              // กดรายการโดยไม่ให้ช่องพิมพ์เสียโฟกัสก่อน — ไม่งั้นรายการปิดตัวเองก่อนที่การกดจะทำงาน
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => pick(p)}
              className={cn(
                "w-full rounded-lg px-2.5 py-2.5 text-left text-sm font-medium transition-colors hover:bg-accent/50",
                i === active && "bg-accent/60"
              )}
            >
              {p.name}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
