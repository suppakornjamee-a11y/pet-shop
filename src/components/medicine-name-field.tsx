"use client";

import { useEffect, useId, useMemo, useRef, useState } from "react";
import { matchMedicine, type FleaTickProductInfo, type Species } from "@/lib/flea-tick";
import { cn } from "@/lib/utils";
import { useI18n } from "@/components/i18n-provider";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

const LIFF_FIELD = "h-11 rounded-xl bg-card";
const INVALID = "border-destructive focus-visible:border-destructive focus-visible:ring-destructive/40";

/**
 * ช่องกรอกชื่อยาเห็บหมัดแบบ autocomplete — แตะช่องแล้วเปิดรายการยาให้เลือกทันที พิมพ์ต่อรายการจะกรองตามที่พิมพ์
 * (พิมพ์แค่ส่วนแรกของชื่อ ชื่อไทย หรือสะกดผิดเล็กน้อยก็เจอ) เลือกด้วยการกดหรือใช้ลูกศร + Enter ก็ได้
 *
 * รายการลอยทับเนื้อหาใต้ช่อง (ไม่ดันหน้า) และเลื่อนหน้าให้เห็นเองเมื่อเปิด — บนมือถือรายการที่แสดงต่อท้ายช่องในหน้า
 * มักไปซ่อนอยู่หลังคีย์บอร์ดหรือปุ่มที่แปะด้านล่างจอ
 * เลือกแล้วเติมชื่อเต็มของยาลงช่องให้ และไม่เลือกให้เองเด็ดขาด (ต้องกดเลือกเอง)
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

  const selected = catalog.find((p) => p.id === productId) ?? null;
  const typed = value.trim().length >= 2;

  const options = useMemo(() => {
    if (selected) return [];
    if (typed) return matchMedicine(value, catalog, species).slice(0, 6).map((m) => m.product);
    // ยังไม่ได้พิมพ์ (หรือพิมพ์ตัวเดียว): แสดงยาทั้งหมดที่ใช้กับสัตว์ชนิดนี้ให้เลือกจากรายการ
    return catalog
      .filter((p) => !p.species || p.species === species)
      .sort((a, b) => a.name.localeCompare(b.name, "th"))
      .slice(0, 8);
  }, [selected, typed, value, catalog, species]);

  const show = open && !readOnly && options.length > 0;

  // เปิดรายการแล้วเลื่อนหน้าให้เห็นทั้งรายการ เว้นที่ด้านล่างไว้ให้ปุ่มที่แปะขอบจอ (scroll-mb ที่ตัวรายการ)
  useEffect(() => {
    if (show) listRef.current?.scrollIntoView({ block: "nearest", behavior: "smooth" });
  }, [show, options.length]);

  const describe = (p: FleaTickProductInfo) =>
    [p.formula, p.species ? t.labels.species[p.species] : null, t.fleaTick.form[p.form]].filter(Boolean).join(" · ");

  function pick(p: FleaTickProductInfo) {
    onChange({ fleaTickMedicine: p.name, fleaTickProductId: p.id });
    setOpen(false);
    setActive(-1);
    inputRef.current?.blur(); // ปิดคีย์บอร์ดบนมือถือ
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

      {selected ? (
        <div className="flex items-start justify-between gap-2 rounded-xl border border-primary/40 bg-primary/5 px-3 py-2 text-sm">
          <div className="min-w-0">
            <div className="font-medium">{selected.name}</div>
            <div className="text-xs text-muted-foreground">{describe(selected)}</div>
          </div>
          {!readOnly && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-7 shrink-0 px-2 text-xs"
              onClick={() => onChange({ fleaTickProductId: null })}
            >
              {t.fleaTick.change}
            </Button>
          )}
        </div>
      ) : (
        showNoMatchHint &&
        !readOnly &&
        typed &&
        options.length === 0 && <p className="text-xs text-muted-foreground">{t.fleaTick.noMatchHint}</p>
      )}

      {show && (
        <div
          ref={listRef}
          id={listId}
          role="listbox"
          className="absolute inset-x-0 top-full z-30 mt-1 max-h-64 scroll-mb-28 overflow-y-auto rounded-xl border bg-popover p-1 shadow-lg"
        >
          {typed && <p className="px-2 pb-1 pt-1.5 text-xs font-medium text-muted-foreground">{t.fleaTick.didYouMean}</p>}
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
                "flex w-full flex-col items-start rounded-lg px-2.5 py-2 text-left text-sm transition-colors hover:bg-accent/50",
                i === active && "bg-accent/60"
              )}
            >
              <span className="font-medium">{p.name}</span>
              <span className="text-xs text-muted-foreground">{describe(p)}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
