"use client";

import { useMemo } from "react";
import { AlertTriangle, Bug, CheckCircle2, type LucideIcon } from "lucide-react";
import type { FleaTickProductInfo } from "@/lib/flea-tick";
import { assessFleaTick, validateFleaDeclaration, type FleaAssessment } from "@/lib/flea-tick-check";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { EMPTY_FLEA, type FleaDraft, type ItemDraft } from "./cart";
import { dayLabel, declarationError, fleaDataOf } from "./flea-validation";
import { ImagePicker } from "./image-picker";
import { MedicineNameField } from "@/components/medicine-name-field";
import type { FieldError } from "./pet-quick-form";
import { Section, todayStr, type CtxPet, type T } from "./shared";

const FIELD = "h-11 rounded-xl bg-card";
const INVALID = "border-destructive focus-visible:border-destructive focus-visible:ring-destructive/40";

/**
 * ตรวจคำตอบเรื่องยาเห็บหมัดของรายการอาบน้ำก่อนไปหน้าตรวจสอบรายการ — คืนช่องแรกที่ยังไม่ครบ (เซิร์ฟเวอร์ตรวจซ้ำอีกชั้น)
 */
export function validateFleaForDraft(
  draft: ItemDraft,
  pet: CtxPet,
  catalog: FleaTickProductInfo[],
  t: T
): FieldError | null {
  if (draft.kind !== "BATH") return null;
  const stored = fleaDataOf(pet);
  const today = todayStr();
  const pre = assessFleaTick(stored, catalog, draft.date, today);
  const flea = draft.flea ?? EMPTY_FLEA;
  if (pre.level === "ASK" && !flea.choice) return { id: "flea-choice", message: t.liffBook.fleaChoiceRequired };
  if (flea.choice !== "declare") return null;

  const error = validateFleaDeclaration({
    declaration: { medicine: flea.medicine, productId: flea.productId, date: flea.date, evidence: flea.evidence },
    pre,
    stored,
    catalog,
    today,
  });
  if (!error) return null;
  return declarationError(error, stored, t);
}

/** เส้นขอบของตรา: วงกลมที่ขอบเป็นคลื่น 8 กลีบ (แบบตราไอคอนยืนยันของ IG/Facebook) คำนวณครั้งเดียวตอนโหลดโมดูล */
const SEAL_PATH = (() => {
  const points: string[] = [];
  const steps = 160;
  for (let i = 0; i <= steps; i++) {
    const theta = (i / steps) * Math.PI * 2;
    const r = 9.7 + 1.1 * Math.cos(8 * theta);
    points.push(`${(12 + r * Math.cos(theta)).toFixed(2)} ${(12 + r * Math.sin(theta)).toFixed(2)}`);
  }
  return `M${points.join("L")}Z`;
})();

/** ตราแบบไอคอนยืนยันของ IG/Facebook — สีเหลืองอำพัน + นาฬิกา = รอตรวจสอบ */
function PendingSeal({ label }: { label: string }) {
  return (
    <span className="inline-flex items-center gap-1" role="status" aria-label={label}>
      <svg viewBox="0 0 24 24" className="h-6 w-6 shrink-0 text-amber-500 drop-shadow-sm" aria-hidden>
        <path d={SEAL_PATH} fill="currentColor" />
        <circle cx="12" cy="12" r="4.3" fill="none" stroke="white" strokeWidth="1.8" />
        <path d="M12 9.9V12l1.5 1" fill="none" stroke="white" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
      <span className="text-xs font-medium text-amber-700">{label}</span>
    </span>
  );
}

function statusLine(pre: FleaAssessment, t: T): { text: string; tone: string; icon: LucideIcon } | null {
  const due = pre.status.nextDueDate ? ` · ${t.fleaTick.nextDue(dayLabel(pre.status.nextDueDate))}` : "";
  if (pre.level === "GREEN") {
    return { text: `${t.fleaTick.status.COVERED}${due}`, tone: "bg-emerald-50 text-emerald-700", icon: CheckCircle2 };
  }
  if (pre.level === "ASK" && pre.ask === "EXPIRED") {
    return { text: `${t.fleaTick.status.DUE_BEFORE_SERVICE}${due}`, tone: "bg-rose-50 font-medium text-rose-700", icon: AlertTriangle };
  }
  if (pre.level === "ASK" && pre.ask === "SPECIES_MISMATCH") {
    return { text: t.liffBook.fleaSpeciesMismatch, tone: "bg-amber-50 font-medium text-amber-800", icon: AlertTriangle };
  }
  // ข้อมูลไม่ครบ / ยายังไม่ยืนยันในฐานข้อมูล: ไม่แสดงแถบ — ใช้ป้ายรอตรวจสอบที่หัวข้อแทน
  return null;
}

/**
 * ตรวจยาเห็บหมัดตอนเลือกวันเวลา (งานอาบน้ำ) — เทียบข้อมูลที่บันทึกไว้กับวันบริการที่เลือก
 * เขียว: ผ่านเอง แสดงสรุปสั้นๆ (แก้ข้อมูลเองได้) · ต้องถาม: ครบกำหนดก่อนวันบริการ / ยาไม่ตรงชนิดสัตว์ — ต้องเลือกคำตอบก่อนไปต่อ
 * รอตรวจสอบ (ไม่มีข้อมูล ข้อมูลไม่ครบ ยายังไม่อยู่ในฐานข้อมูลที่ยืนยันแล้ว): เหลือแค่หัวข้อกับตราสถานะ ไม่ถามอะไรลูกค้า
 * พนักงานตรวจตอนเช็คคิว (ลูกค้าแก้ข้อมูลยาได้ที่ฟอร์ม "มีข้อมูลอัปเดต" ของหน้าแรก)
 */
export function FleaTickSection({
  draft,
  set,
  pet,
  catalog,
  invalidId,
  t,
}: {
  draft: ItemDraft;
  set: (patch: Partial<ItemDraft>) => void;
  pet: CtxPet;
  catalog: FleaTickProductInfo[];
  invalidId?: string | null;
  t: T;
}) {
  const stored = useMemo(() => fleaDataOf(pet), [pet]);
  const today = todayStr();
  const pre = useMemo(() => assessFleaTick(stored, catalog, draft.date, today), [stored, catalog, draft.date, today]);
  const flea = draft.flea ?? EMPTY_FLEA;
  const setFlea = (patch: Partial<FleaDraft>) => set({ flea: { ...flea, ...patch } });
  const bad = (id: string) => invalidId === id;

  const asking = pre.level === "ASK";
  const expired = pre.level === "ASK" && pre.ask === "EXPIRED";
  // รอตรวจสอบ = ไม่มีข้อมูล/ข้อมูลไม่ครบ/ยายังไม่ยืนยัน → ส่วนนี้เหลือแค่หัวข้อกับป้าย ไม่ถามอะไรลูกค้า พนักงานตรวจตอนเช็คคิว
  const pending = pre.level === "RED";
  const productName = catalog.find((p) => p.id === stored.productId)?.name;
  const line = statusLine(pre, t);

  function startDeclare() {
    setFlea({
      choice: "declare",
      medicine: stored.medicine,
      productId: stored.productId,
      // ครบกำหนดแล้วบอกว่าให้ยาครั้งใหม่ = วันที่ต้องเป็นครั้งใหม่ จึงเริ่มจากช่องว่าง ส่วนกรณีอื่นเริ่มจากค่าเดิมให้แก้
      date: expired ? "" : (stored.givenAt ?? ""),
      evidence: [],
    });
  }

  function onChoice(value: string) {
    if (value === "declare") startDeclare();
    else if (value === "none") setFlea({ choice: "none" });
    else setFlea({ choice: "" });
  }

  return (
    <Section title={t.fleaTick.title} icon={Bug} titleExtra={pending ? <PendingSeal label={t.fleaTick.pending} /> : undefined}>
      {!pending && (
        <dl className="divide-y rounded-xl border text-sm">
          <div className="flex flex-col gap-0.5 px-3 py-2 sm:flex-row sm:items-start sm:justify-between sm:gap-4">
            <dt className="shrink-0 text-xs text-muted-foreground sm:max-w-[45%] sm:text-sm">{t.liffBook.fleaMedicine}</dt>
            <dd className="font-medium sm:text-right">{productName || stored.medicine.trim() || "-"}</dd>
          </div>
          <div className="flex flex-col gap-0.5 px-3 py-2 sm:flex-row sm:items-start sm:justify-between sm:gap-4">
            <dt className="shrink-0 text-xs text-muted-foreground sm:max-w-[45%] sm:text-sm">{t.liffBook.fleaDate}</dt>
            <dd className="font-medium sm:text-right">{stored.givenAt ? dayLabel(stored.givenAt) : "-"}</dd>
          </div>
        </dl>
      )}
      {line && (
        <p className={cn("flex items-start gap-2 rounded-xl px-3 py-2 text-sm", line.tone)}>
          <line.icon className="mt-0.5 h-4 w-4 shrink-0" />
          <span>{line.text}</span>
        </p>
      )}

      {asking && (
        <div className="space-y-1.5">
          <Label htmlFor="flea-choice">{t.liffBook.fleaAnswerLabel}</Label>
          <select
            id="flea-choice"
            className={cn("h-11 w-full rounded-xl border bg-card px-3 text-sm", bad("flea-choice") && INVALID)}
            value={flea.choice}
            onChange={(e) => onChoice(e.target.value)}
          >
            <option value="" disabled />
            <option value="declare">{expired ? t.liffBook.fleaRenewed : t.liffBook.fleaFix}</option>
            <option value="none">{expired ? t.liffBook.fleaNotRenewed : t.liffBook.fleaUnsure}</option>
          </select>
        </div>
      )}

      {!asking && !pending && flea.choice !== "declare" && (
        <Button type="button" variant="outline" className="w-full rounded-xl" onClick={startDeclare}>
          {t.liffBook.fleaFix}
        </Button>
      )}

      {flea.choice === "declare" && (
        <div className="space-y-3 border-t pt-3">
          <div className="space-y-1.5">
            <Label htmlFor="flea-medicine">{t.liffBook.fleaMedicine}</Label>
            <MedicineNameField
              inputId="flea-medicine"
              invalid={bad("flea-medicine")}
              value={flea.medicine}
              productId={flea.productId}
              species={pet.species}
              catalog={catalog}
              onChange={(patch) =>
                setFlea({
                  medicine: patch.fleaTickMedicine ?? flea.medicine,
                  productId: patch.fleaTickProductId !== undefined ? patch.fleaTickProductId : flea.productId,
                })
              }
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="flea-date">{t.liffBook.fleaDate}</Label>
            <Input
              id="flea-date"
              type="date"
              lang="en-GB"
              max={today}
              className={cn(FIELD, bad("flea-date") && INVALID)}
              value={flea.date}
              onChange={(e) => setFlea({ date: e.target.value })}
            />
          </div>
          <ImagePicker
            id="flea-evidence"
            label={t.fleaTick.evidenceLabel}
            images={flea.evidence}
            onChange={(evidence) => setFlea({ evidence })}
            max={3}
            maxSide={1100}
            invalid={bad("flea-evidence")}
            t={t}
          />
          {!asking && (
            <Button type="button" variant="ghost" size="sm" onClick={() => setFlea({ choice: "" })}>
              {t.common.cancel}
            </Button>
          )}
        </div>
      )}
    </Section>
  );
}
