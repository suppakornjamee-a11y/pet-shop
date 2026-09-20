"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { BadgeCheck, Loader2, Pencil, Plus, Save, ShieldCheck } from "lucide-react";
import { confirmPetFleaTick, upsertFleaTickProduct, verifyFleaTickProduct } from "@/app/actions/flea-tick";
import { formatDate } from "@/lib/format";
import { medicineNameKnown, testMedicineMatch } from "@/lib/flea-tick";
import { cn } from "@/lib/utils";
import { useI18n } from "@/components/i18n-provider";
import { SpeciesIcon } from "@/components/species-icon";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { AliasInput } from "./alias-input";

type Unit = "DAY" | "WEEK" | "MONTH";
type Form = "CHEWABLE" | "SPOT_ON" | "COLLAR" | "OTHER";
type Species = "DOG" | "CAT";

export type ManagedProduct = {
  id: string;
  name: string;
  formula: string | null;
  aliases: string[];
  species: Species | null;
  form: Form;
  tickValue: number | null;
  tickUnit: Unit | null;
  fleaValue: number | null;
  fleaUnit: Unit | null;
  bathNote: string | null;
  labelSource: string | null;
  note: string | null;
  status: "PENDING" | "VERIFIED";
  verifiedByName: string | null;
  verifiedAt: string | null;
  active: boolean;
};

export type ReviewPet = {
  id: string;
  name: string;
  species: Species;
  ownerName: string;
  typed: string | null;
  givenAt: string | null;
  productId: string | null;
  evidenceUrls: string[];
};

type FormState = {
  name: string;
  formula: string;
  aliases: string[];
  species: "" | Species;
  form: Form;
  tickValue: string;
  tickUnit: "" | Unit;
  fleaValue: string;
  fleaUnit: "" | Unit;
  bathNote: string;
  labelSource: string;
  note: string;
  active: boolean;
};

const emptyForm: FormState = {
  name: "",
  formula: "",
  aliases: [],
  species: "",
  form: "OTHER",
  tickValue: "",
  tickUnit: "",
  fleaValue: "",
  fleaUnit: "",
  bathNote: "",
  labelSource: "",
  note: "",
  active: true,
};

const SELECT_CLASS = "h-9 w-full rounded-md border bg-background px-2 text-sm";

/**
 * หน้าจัดการยาเห็บหมัด — ผู้จัดการดูแลฐานข้อมูลยา (แก้/ยืนยัน) ส่วนพนักงานตรวจหลักฐานของลูกค้าได้
 * ยาที่ยังไม่ยืนยันจะไม่ถูกนำไปคำนวณระยะคุ้มครอง และแก้ตัวเลขที่ใช้คำนวณแล้วต้องยืนยันใหม่
 */
export function FleaTickManager({
  products,
  review,
  isAdmin,
}: {
  products: ManagedProduct[];
  review: ReviewPet[];
  isAdmin: boolean;
}) {
  const { t } = useI18n();
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [open, setOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<FormState>(emptyForm);
  const [picked, setPicked] = useState<Record<string, string>>({});
  // ติ๊ก "จำชื่อที่ลูกค้าพิมพ์เป็นชื่อใกล้เคียง" ของแต่ละรายการรอตรวจ (ค่าเริ่มต้น = ติ๊ก)
  const [learn, setLearn] = useState<Record<string, boolean>>({});
  // ช่องทดสอบการค้นหาในหน้าต่างแก้ไขยา
  const [testQuery, setTestQuery] = useState("");
  const [zoom, setZoom] = useState<string | null>(null);

  const period = (v: number | null, u: Unit | null) => (v && u ? `${v} ${t.fleaTick.unit[u]}` : t.fleaTick.notSpecified);

  function openNew() {
    setEditingId(null);
    setForm(emptyForm);
    setTestQuery("");
    setOpen(true);
  }
  function openEdit(p: ManagedProduct) {
    setEditingId(p.id);
    setForm({
      name: p.name,
      formula: p.formula ?? "",
      aliases: p.aliases,
      species: p.species ?? "",
      form: p.form,
      tickValue: p.tickValue ? String(p.tickValue) : "",
      tickUnit: p.tickUnit ?? "",
      fleaValue: p.fleaValue ? String(p.fleaValue) : "",
      fleaUnit: p.fleaUnit ?? "",
      bathNote: p.bathNote ?? "",
      labelSource: p.labelSource ?? "",
      note: p.note ?? "",
      active: p.active,
    });
    setTestQuery("");
    setOpen(true);
  }

  function run(fn: () => Promise<{ ok: boolean; error?: string; message?: string }>, after?: () => void) {
    startTransition(async () => {
      const res = await fn();
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      toast.success(res.message);
      after?.();
      router.refresh();
    });
  }

  function save() {
    run(
      () =>
        upsertFleaTickProduct({
          id: editingId ?? undefined,
          name: form.name,
          formula: form.formula,
          aliases: form.aliases,
          species: form.species || null,
          form: form.form,
          tickValue: form.tickValue ? Number(form.tickValue) : null,
          tickUnit: form.tickUnit || null,
          fleaValue: form.fleaValue ? Number(form.fleaValue) : null,
          fleaUnit: form.fleaUnit || null,
          bathNote: form.bathNote,
          labelSource: form.labelSource,
          note: form.note,
          active: form.active,
        }),
      () => setOpen(false)
    );
  }

  return (
    <div className="space-y-6">
      {/* ===== รอตรวจสอบ ===== */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">
            {t.fleaTick.reviewTitle} ({review.length})
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {review.length === 0 ? (
            <p className="py-4 text-center text-sm text-muted-foreground">{t.fleaTick.reviewEmpty}</p>
          ) : (
            review.map((r) => {
              const options = products.filter((p) => p.active && (!p.species || p.species === r.species));
              const value = picked[r.id] ?? r.productId ?? "";
              const chosen = products.find((p) => p.id === value);
              // เสนอให้จำชื่อที่ลูกค้าพิมพ์ก็ต่อเมื่อชื่อนั้นยังไม่ตรงกับชื่อหลัก/สูตร/ชื่อใกล้เคียงของยาที่เลือก
              const canLearn = !!chosen && !!r.typed?.trim() && !medicineNameKnown(r.typed, chosen);
              const willLearn = canLearn && (learn[r.id] ?? true);
              return (
                <div key={r.id} className="grid gap-3 rounded-lg border p-3 md:grid-cols-[1fr_auto]">
                  <div className="min-w-0 space-y-1.5">
                    <div className="flex items-center gap-1.5 font-medium">
                      <SpeciesIcon species={r.species} className="h-4 w-4" />
                      {r.name}
                      <span className="font-normal text-muted-foreground">· {r.ownerName}</span>
                    </div>
                    <div className="text-sm">
                      <span className="text-muted-foreground">{t.fleaTick.typedLabel}: </span>
                      {r.typed || "-"}
                    </div>
                    <div className="text-sm">
                      <span className="text-muted-foreground">{t.fleaTick.givenLabel}: </span>
                      {r.givenAt ? formatDate(r.givenAt) : "-"}
                    </div>
                    {r.evidenceUrls.length > 0 && (
                      <div className="flex flex-wrap gap-2 pt-1">
                        {r.evidenceUrls.map((src, i) => (
                          <button
                            key={i}
                            type="button"
                            onClick={() => setZoom(src)}
                            className="h-16 w-16 overflow-hidden rounded-md ring-1 ring-border hover:ring-2 hover:ring-primary"
                          >
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img src={src} alt="" className="h-full w-full object-cover" />
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                  <div className="flex flex-col gap-2 md:w-72">
                    <Label className="text-xs">{t.fleaTick.pickProduct}</Label>
                    <select
                      className={SELECT_CLASS}
                      value={value}
                      onChange={(e) => setPicked((prev) => ({ ...prev, [r.id]: e.target.value }))}
                    >
                      <option value="" />
                      {options.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.name}
                        </option>
                      ))}
                    </select>
                    {canLearn && (
                      <label className="flex items-start gap-2 text-xs">
                        <input
                          type="checkbox"
                          className="mt-0.5 h-3.5 w-3.5 accent-primary"
                          checked={willLearn}
                          onChange={(e) => setLearn((prev) => ({ ...prev, [r.id]: e.target.checked }))}
                        />
                        {t.fleaTick.learnAlias(r.typed!.trim())}
                      </label>
                    )}
                    <Button
                      size="sm"
                      disabled={isPending || !value}
                      onClick={() => run(() => confirmPetFleaTick(r.id, value, willLearn))}
                    >
                      <ShieldCheck /> {t.fleaTick.confirmCheck}
                    </Button>
                  </div>
                </div>
              );
            })
          )}
        </CardContent>
      </Card>

      {/* ===== ฐานข้อมูลยา ===== */}
      <Card>
        <CardHeader className="flex-row items-center justify-between">
          <CardTitle className="text-base">{t.fleaTick.productsTitle}</CardTitle>
          {isAdmin && (
            <Button size="sm" onClick={openNew}>
              <Plus /> {t.fleaTick.addProduct}
            </Button>
          )}
        </CardHeader>
        <CardContent className="space-y-2">
          {products.map((p) => (
            <div
              key={p.id}
              className={cn("grid gap-2 rounded-lg border p-3 md:grid-cols-[1fr_auto]", !p.active && "opacity-50")}
            >
              <div className="min-w-0 space-y-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-medium">{p.name}</span>
                  <span
                    className={cn(
                      "rounded-full px-2 py-0.5 text-[0.6875rem] font-medium",
                      p.status === "VERIFIED"
                        ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-300"
                        : "bg-amber-100 text-amber-800 dark:bg-amber-950/50 dark:text-amber-300"
                    )}
                  >
                    {p.status === "VERIFIED" ? t.fleaTick.verified : t.fleaTick.pending}
                  </span>
                  {!p.active && <span className="text-xs text-muted-foreground">{t.fleaTick.inactive}</span>}
                </div>
                <div className="text-xs text-muted-foreground">
                  {[
                    p.formula,
                    p.species ? t.labels.species[p.species] : t.fleaTick.speciesAny,
                    t.fleaTick.form[p.form],
                  ]
                    .filter(Boolean)
                    .join(" · ")}
                </div>
                <div className="text-sm">
                  {t.fleaTick.tickLabel}: {period(p.tickValue, p.tickUnit)} · {t.fleaTick.fleaLabel}:{" "}
                  {period(p.fleaValue, p.fleaUnit)}
                </div>
                {p.aliases.length > 0 && (
                  <div className="text-xs text-muted-foreground">
                    {t.fleaTick.aliasesShort}: {p.aliases.join(" · ")}
                  </div>
                )}
                {p.note && <div className="text-xs text-muted-foreground">{p.note}</div>}
                {p.status === "VERIFIED" && p.verifiedByName && p.verifiedAt && (
                  <div className="text-xs text-muted-foreground">
                    {t.fleaTick.verifiedBy(p.verifiedByName, formatDate(p.verifiedAt))}
                  </div>
                )}
              </div>
              {isAdmin && (
                <div className="flex items-start gap-2">
                  <Button variant="outline" size="sm" onClick={() => openEdit(p)}>
                    <Pencil /> {t.common.edit}
                  </Button>
                  {p.status !== "VERIFIED" && (
                    <Button size="sm" disabled={isPending} onClick={() => run(() => verifyFleaTickProduct(p.id))}>
                      <BadgeCheck /> {t.fleaTick.verify}
                    </Button>
                  )}
                </div>
              )}
            </div>
          ))}
        </CardContent>
      </Card>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-xl">
          <DialogHeader>
            <DialogTitle>{editingId ? t.fleaTick.editProduct : t.fleaTick.addProduct}</DialogTitle>
          </DialogHeader>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5 sm:col-span-2">
              <Label htmlFor="ft-name">{t.fleaTick.nameLabel}</Label>
              <Input id="ft-name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="ft-formula">{t.fleaTick.formulaLabel}</Label>
              <Input
                id="ft-formula"
                value={form.formula}
                onChange={(e) => setForm({ ...form, formula: e.target.value })}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="ft-species">{t.fleaTick.speciesLabel}</Label>
              <select
                id="ft-species"
                className={SELECT_CLASS}
                value={form.species}
                onChange={(e) => setForm({ ...form, species: e.target.value as FormState["species"] })}
              >
                <option value="">{t.fleaTick.speciesAny}</option>
                <option value="DOG">{t.labels.species.DOG}</option>
                <option value="CAT">{t.labels.species.CAT}</option>
              </select>
            </div>
            <div className="space-y-1.5 sm:col-span-2">
              <Label htmlFor="ft-aliases">{t.fleaTick.aliasesLabel}</Label>
              <AliasInput
                id="ft-aliases"
                values={form.aliases}
                onChange={(aliases) => setForm({ ...form, aliases })}
                placeholder={t.fleaTick.aliasesPlaceholder}
                removeLabel={t.fleaTick.removeAlias}
              />
              {/* ลองพิมพ์คำที่ลูกค้าอาจพิมพ์ ดูว่ายาตัวนี้จะขึ้นให้เลือกไหม (ใช้ชื่อหลัก/สูตร/ชื่อใกล้เคียงที่กำลังกรอกอยู่) */}
              <div className="space-y-1 pt-1">
                <Label htmlFor="ft-test" className="text-xs text-muted-foreground">
                  {t.fleaTick.testLabel}
                </Label>
                <Input
                  id="ft-test"
                  value={testQuery}
                  placeholder={t.fleaTick.testPlaceholder}
                  onChange={(e) => setTestQuery(e.target.value)}
                />
                {testQuery.trim().length >= 2 &&
                  (() => {
                    const hit = testMedicineMatch(testQuery, {
                      name: form.name,
                      formula: form.formula || null,
                      aliases: form.aliases,
                    });
                    return hit ? (
                      <p className="text-xs text-emerald-700 dark:text-emerald-400">{t.fleaTick.testHit(hit.via)}</p>
                    ) : (
                      <p className="text-xs text-muted-foreground">{t.fleaTick.testMiss}</p>
                    );
                  })()}
              </div>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="ft-form">{t.fleaTick.formLabel}</Label>
              <select
                id="ft-form"
                className={SELECT_CLASS}
                value={form.form}
                onChange={(e) => setForm({ ...form, form: e.target.value as Form })}
              >
                {(["CHEWABLE", "SPOT_ON", "COLLAR", "OTHER"] as const).map((f) => (
                  <option key={f} value={f}>
                    {t.fleaTick.form[f]}
                  </option>
                ))}
              </select>
            </div>
            <div />
            {(
              [
                ["tick", t.fleaTick.tickLabel],
                ["flea", t.fleaTick.fleaLabel],
              ] as const
            ).map(([key, label]) => (
              <div key={key} className="space-y-1.5">
                <Label htmlFor={`ft-${key}`}>{label}</Label>
                <div className="grid grid-cols-[1fr_auto] gap-2">
                  <Input
                    id={`ft-${key}`}
                    type="number"
                    min={1}
                    value={form[`${key}Value`]}
                    onChange={(e) => setForm({ ...form, [`${key}Value`]: e.target.value })}
                  />
                  <select
                    className={cn(SELECT_CLASS, "w-28")}
                    value={form[`${key}Unit`]}
                    onChange={(e) => setForm({ ...form, [`${key}Unit`]: e.target.value as FormState["tickUnit"] })}
                  >
                    <option value="">{t.fleaTick.notSpecified}</option>
                    {(["DAY", "WEEK", "MONTH"] as const).map((u) => (
                      <option key={u} value={u}>
                        {t.fleaTick.unit[u]}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            ))}
            <div className="space-y-1.5 sm:col-span-2">
              <Label htmlFor="ft-bath">{t.fleaTick.bathNoteLabel}</Label>
              <Textarea
                id="ft-bath"
                rows={2}
                value={form.bathNote}
                onChange={(e) => setForm({ ...form, bathNote: e.target.value })}
              />
            </div>
            <div className="space-y-1.5 sm:col-span-2">
              <Label htmlFor="ft-source">{t.fleaTick.labelSourceLabel}</Label>
              <Input
                id="ft-source"
                value={form.labelSource}
                onChange={(e) => setForm({ ...form, labelSource: e.target.value })}
              />
            </div>
            <div className="space-y-1.5 sm:col-span-2">
              <Label htmlFor="ft-note">{t.fleaTick.noteLabel}</Label>
              <Textarea
                id="ft-note"
                rows={2}
                value={form.note}
                onChange={(e) => setForm({ ...form, note: e.target.value })}
              />
            </div>
            <label className="flex items-center gap-2 text-sm sm:col-span-2">
              <Switch checked={form.active} onCheckedChange={(v) => setForm({ ...form, active: v })} />
              {t.fleaTick.activeLabel}
            </label>
          </div>
          <DialogFooter>
            <Button onClick={save} disabled={isPending || !form.name.trim()}>
              {isPending ? <Loader2 className="animate-spin" /> : <Save />} {t.common.save}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={zoom !== null} onOpenChange={(o) => !o && setZoom(null)}>
        <DialogContent className="p-2 sm:max-w-3xl">
          <DialogTitle className="sr-only">{t.fleaTick.evidenceLabel}</DialogTitle>
          {zoom && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={zoom} alt="" className="max-h-[80dvh] w-full rounded-lg object-contain" />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
