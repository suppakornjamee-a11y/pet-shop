"use client";

import { useRef, useState } from "react";
import { toast } from "sonner";
import { ImagePlus, Loader2, X } from "lucide-react";
import { compressImageToDataUrl } from "@/lib/file";
import { cn } from "@/lib/utils";
import { Label } from "@/components/ui/label";
import type { T } from "./shared";

/**
 * เลือกรูปหลายรูป (ย่อขนาดก่อนเก็บ) — ใช้กับภาพตัวอย่างทรงขน และรูปหลักฐานยาเห็บหมัด
 * id ติดที่ปุ่มเพิ่มรูป เพื่อให้หน้าจอโฟกัสมาที่นี่ได้ตอนตรวจว่ายังไม่ได้แนบ
 */
export function ImagePicker({
  id,
  label,
  images,
  onChange,
  max = 3,
  maxSide = 1000,
  invalid = false,
  t,
}: {
  id?: string;
  label: string;
  images: string[];
  onChange: (v: string[]) => void;
  max?: number;
  maxSide?: number;
  invalid?: boolean;
  t: T;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);

  async function add(files: FileList | null) {
    if (!files) return;
    setBusy(true);
    try {
      const next = [...images];
      for (const f of Array.from(files).slice(0, max - images.length)) {
        // ย่อให้เล็กกว่าสลิป — ส่งไปพร้อมคำขอจองหลายรายการในครั้งเดียว (ขนาดคำขอรวมมีเพดาน)
        next.push(await compressImageToDataUrl(f, { maxSide, quality: 0.72 }));
      }
      onChange(next);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : t.liff.errorTitle);
    } finally {
      setBusy(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  return (
    <div className="space-y-1.5">
      <Label>{label}</Label>
      <div className="flex flex-wrap gap-2">
        {images.map((src, i) => (
          <div key={i} className="relative h-20 w-20 overflow-hidden rounded-xl border">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={src} alt="" className="h-full w-full object-cover" />
            <button
              type="button"
              aria-label={t.liffBook.remove}
              onClick={() => onChange(images.filter((_, j) => j !== i))}
              className="absolute right-1 top-1 flex h-6 w-6 items-center justify-center rounded-full bg-black/60 text-white"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        ))}
        {images.length < max && (
          <button
            id={id}
            type="button"
            disabled={busy}
            onClick={() => inputRef.current?.click()}
            className={cn(
              "flex h-20 w-20 items-center justify-center rounded-xl border border-dashed text-muted-foreground transition-colors hover:bg-muted",
              invalid && "border-destructive border-solid focus-visible:ring-destructive/40"
            )}
          >
            {busy ? <Loader2 className="h-5 w-5 animate-spin" /> : <ImagePlus className="h-5 w-5" />}
          </button>
        )}
      </div>
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        multiple
        className="hidden"
        onChange={(e) => add(e.target.files)}
      />
    </div>
  );
}
