"use client";

import { useState } from "react";
import { X } from "lucide-react";
import { normalizeMedicineName } from "@/lib/flea-tick";

/**
 * ช่องกรอกชื่อใกล้เคียงแบบป้าย — พิมพ์แล้วกด Enter หรือ , เพื่อเพิ่ม กด x เพื่อลบ
 * วางข้อความที่คั่นด้วยจุลภาคหลายชื่อพร้อมกันได้ ชื่อที่ซ้ำ (ไม่นับตัวพิมพ์/ช่องว่าง) จะไม่ถูกเพิ่มซ้ำ
 */
export function AliasInput({
  id,
  values,
  onChange,
  placeholder,
  removeLabel,
}: {
  id?: string;
  values: string[];
  onChange: (v: string[]) => void;
  placeholder?: string;
  removeLabel: string;
}) {
  const [draft, setDraft] = useState("");

  function commit(raw: string) {
    const parts = raw
      .split(/[,\n]/)
      .map((s) => s.trim())
      .filter(Boolean);
    if (parts.length === 0) {
      setDraft("");
      return;
    }
    const next = [...values];
    for (const part of parts) {
      const key = normalizeMedicineName(part);
      if (key && !next.some((v) => normalizeMedicineName(v) === key)) next.push(part);
    }
    onChange(next);
    setDraft("");
  }

  return (
    <div className="flex min-h-9 flex-wrap items-center gap-1.5 rounded-md border bg-background px-2 py-1.5 focus-within:ring-2 focus-within:ring-ring/50">
      {values.map((v) => (
        <span key={v} className="inline-flex items-center gap-1 rounded-full bg-muted px-2.5 py-0.5 text-sm">
          {v}
          <button
            type="button"
            aria-label={`${removeLabel}: ${v}`}
            onClick={() => onChange(values.filter((x) => x !== v))}
            className="text-muted-foreground hover:text-destructive"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </span>
      ))}
      <input
        id={id}
        value={draft}
        placeholder={values.length === 0 ? placeholder : undefined}
        className="min-w-32 flex-1 bg-transparent py-0.5 text-sm outline-none placeholder:text-muted-foreground"
        onChange={(e) => (e.target.value.includes(",") ? commit(e.target.value) : setDraft(e.target.value))}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            commit(draft);
          } else if (e.key === "Backspace" && draft === "" && values.length > 0) {
            onChange(values.slice(0, -1));
          }
        }}
        onBlur={() => commit(draft)}
      />
    </div>
  );
}
