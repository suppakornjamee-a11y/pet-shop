"use client";

import { useState } from "react";
import {
  AlertTriangle,
  CalendarHeart,
  Eye,
  HeartPulse,
  Loader2,
  MessageCircle,
  NotebookText,
  Phone,
  Syringe,
  UserRound,
  UtensilsCrossed,
  Pill,
  Smile,
} from "lucide-react";
import {
  getCustomerPreview,
  type CustomerPreview,
} from "@/app/actions/customers";
import { ageFromBirthDate, formatDate } from "@/lib/format";
import { allergyText } from "@/lib/pet-notes";
import { cn } from "@/lib/utils";
import { useI18n } from "@/components/i18n-provider";
import { SpeciesIcon } from "@/components/species-icon";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog";

type Pet = CustomerPreview["pets"][number];
type T = ReturnType<typeof useI18n>["t"];

/** ป้ายของฟอร์มลงทะเบียนมี " *" บอกช่องบังคับ — ในหน้าดูอย่างเดียวไม่ต้องมี */
const plain = (label: string) => label.replace(/\s*\*\s*$/, "");

/**
 * ปุ่ม + popup ดูข้อมูลลูกค้าแบบอ่านอย่างเดียว — เนื้อหาเดียวกับหน้าลงทะเบียน แต่จัดให้อ่านเร็ว
 * ข้อควรระวัง (แพ้/ก้าวร้าว) ขึ้นก่อนเป็นกล่องสี เพราะเป็นสิ่งที่พนักงานต้องเห็นก่อนรับตัวน้อง
 */
export function CustomerPreviewButton({
  customerId,
  highlightPetId,
}: {
  customerId: string;
  /** สัตว์เลี้ยงของออเดอร์นี้ — เปิดมาเจอตัวนี้ก่อน */
  highlightPetId: string | null;
}) {
  const { t } = useI18n();
  const [open, setOpen] = useState(false);
  const [data, setData] = useState<CustomerPreview | null>(null);
  const [failed, setFailed] = useState(false);
  const [zoom, setZoom] = useState<string | null>(null);

  async function openPreview() {
    setOpen(true);
    if (data) return;
    setFailed(false);
    try {
      const res = await getCustomerPreview(customerId);
      if (!res) setFailed(true);
      else {
        setData(res);
      }
    } catch {
      setFailed(true);
    }
  }

  return (
    <>
      <Button
        variant="outline"
        size="sm"
        onClick={openPreview}
        className="h-7 gap-1.5 px-2.5 text-xs"
      >
        <Eye className="h-3.5 w-3.5" />
        {t.customerPreview.button}
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[90dvh] gap-0 overflow-y-auto p-0 sm:max-w-2xl">
          {!data ? (
            <div className="flex min-h-64 flex-col items-center justify-center gap-3 p-8 text-sm text-muted-foreground">
              <DialogTitle className="sr-only">
                {t.customerPreview.title}
              </DialogTitle>
              {failed ? (
                t.customerPreview.loadFailed
              ) : (
                <>
                  <Loader2 className="h-6 w-6 animate-spin text-primary" />
                  {t.common.loading}
                </>
              )}
            </div>
          ) : (
            <PreviewBody
              data={data}
              highlightPetId={highlightPetId}
              onZoom={setZoom}
            />
          )}
        </DialogContent>
      </Dialog>

      {/* ขยายรูป — กดรูปย่อในการ์ดสัตว์เลี้ยงเพื่อดูเต็ม (รูปเป็น data URL เปิดแท็บใหม่ไม่ได้) */}
      <Dialog open={zoom !== null} onOpenChange={(o) => !o && setZoom(null)}>
        <DialogContent className="p-2 sm:max-w-3xl">
          <DialogTitle className="sr-only">
            {t.customerPreview.photoZoom}
          </DialogTitle>
          {zoom && (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={zoom}
              alt=""
              className="max-h-[80dvh] w-full rounded-lg object-contain"
            />
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}

/** เนื้อหาใน popup — แยกออกมาให้ทดสอบหน้าตาได้โดยไม่ต้องผ่านการโหลดข้อมูล */
export function PreviewBody({
  data,
  highlightPetId,
  onZoom,
}: {
  data: CustomerPreview;
  highlightPetId: string | null;
  onZoom: (src: string) => void;
}) {
  const { t } = useI18n();
  const [petId, setPetId] = useState<string | null>(
    highlightPetId && data.pets.some((p) => p.id === highlightPetId)
      ? highlightPetId
      : (data.pets[0]?.id ?? null),
  );
  const pet = data.pets.find((p) => p.id === petId) ?? data.pets[0] ?? null;
  const cover = pet?.photoUrls[0] ?? null;

  return (
    <>
      {/* ส่วนหัว: รูปน้อง + ชื่อเจ้าของ + ช่องทางติดต่อหลัก */}
      <div className="flex items-center gap-4 border-b bg-accent/25 px-6 py-5 pr-12">
        <div className="flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-2xl bg-background ring-1 ring-border">
          {cover ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={cover}
              alt={pet?.name ?? ""}
              className="h-full w-full object-cover"
            />
          ) : (
            <UserRound className="h-7 w-7 text-muted-foreground" />
          )}
        </div>
        <div className="min-w-0 space-y-1">
          <DialogTitle className="truncate text-lg leading-tight">
            {data.name}
            {data.nickname && (
              <span className="font-normal text-muted-foreground">
                {" "}
                ({data.nickname})
              </span>
            )}
          </DialogTitle>
          <DialogDescription className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs">
            <span className="inline-flex items-center gap-1">
              <Phone className="h-3.5 w-3.5" />
              {data.phone}
            </span>
            <span>
              {t.customerPreview.memberSince(formatDate(data.createdAt))}
            </span>
          </DialogDescription>
          {(data.createdVia === "LIFF" || data.lineLinked) && (
            <span className="inline-flex items-center gap-1 rounded-full border border-green-300 bg-green-50 px-2 py-0.5 text-[0.6875rem] font-medium text-green-700 dark:border-green-900 dark:bg-green-950/40 dark:text-green-400">
              <MessageCircle className="h-3 w-3" />
              {data.createdVia === "LIFF"
                ? t.customerPreview.registeredViaLine
                : t.customerPreview.lineLinked}
            </span>
          )}
        </div>
      </div>

      <div className="space-y-6 px-6 py-5">
        {/* ข้อมูลเจ้าของ — โชว์เฉพาะช่องที่กรอกไว้ ช่องว่างไม่ต้องกินที่ */}
        <Section icon={UserRound} title={plain(t.register.ownerInfoTitle)}>
          <dl className="grid gap-x-6 gap-y-3 sm:grid-cols-2">
            <Field label={plain(t.register.emailLabel)} value={data.email} />
            <Field label={plain(t.register.lineIdLabel)} value={data.lineId} />
            <Field
              label={plain(t.register.petInstagramLabel)}
              value={data.petInstagram}
            />
            <Field
              label={plain(t.register.preferredLanguageLabel)}
              value={
                data.preferredLanguage === "EN" ? t.language.en : t.language.th
              }
            />
            <Field
              label={plain(t.register.addressLabel)}
              value={data.address}
              wide
            />
            <Field label={plain(t.register.noteLabel)} value={data.note} wide />
          </dl>
        </Section>

        <Section
          icon={HeartPulse}
          title={t.customerPreview.petsTitle(data.pets.length)}
        >
          {data.pets.length > 1 && (
            <div className="-mt-1 mb-4 flex flex-wrap gap-2">
              {data.pets.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => setPetId(p.id)}
                  className={cn(
                    "inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-sm transition-colors",
                    p.id === pet?.id
                      ? "border-primary bg-primary text-primary-foreground"
                      : "bg-background hover:bg-accent/50",
                  )}
                >
                  <SpeciesIcon species={p.species} className="h-4 w-4" />
                  {p.name}
                  {p.id === highlightPetId && (
                    <span className="text-[0.625rem] opacity-80">
                      · {t.customerPreview.inThisOrder}
                    </span>
                  )}
                </button>
              ))}
            </div>
          )}
          {pet ? (
            <PetCard pet={pet} t={t} onZoom={onZoom} />
          ) : (
            <p className="text-xs text-muted-foreground">
              {t.customerPreview.noPets}
            </p>
          )}
        </Section>
      </div>
    </>
  );
}

function PetCard({
  pet,
  t,
  onZoom,
}: {
  pet: Pet;
  t: T;
  onZoom: (src: string) => void;
}) {
  const age = pet.birthDate ? ageFromBirthDate(new Date(pet.birthDate)) : null;
  const allergies = allergyText(pet.allergies);
  const aggressive = allergyText(pet.aggressiveNotes);

  const facts = [
    t.labels.species[pet.species],
    pet.breed,
    t.labels.gender[pet.gender],
    age &&
      `${age.years > 0 ? `${t.register.ageYears(age.years)} ` : ""}${t.register.ageMonths(age.months)}`,
    pet.weightKg != null && t.customerPreview.weight(pet.weightKg),
    pet.color,
    pet.neutered ? t.register.neuteredYes : t.register.neuteredNo,
  ].filter(Boolean) as string[];

  return (
    <div className="space-y-5">
      <div className="space-y-2">
        <div className="flex items-center gap-2 text-base font-semibold">
          <SpeciesIcon species={pet.species} className="h-5 w-5" />
          {pet.name}
        </div>
        <div className="flex flex-wrap gap-1.5">
          {facts.map((f) => (
            <span
              key={f}
              className="rounded-full bg-muted px-2.5 py-0.5 text-xs text-muted-foreground"
            >
              {f}
            </span>
          ))}
        </div>
        {pet.birthDate && (
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <CalendarHeart className="h-3.5 w-3.5" />
            {plain(t.register.birthDateLabel)} {formatDate(pet.birthDate)}
          </div>
        )}
      </div>

      <Thumbs
        photos={pet.photoUrls}
        label={t.customerPreview.petPhotos}
        onZoom={onZoom}
        t={t}
      />

      {/* ข้อควรระวังขึ้นก่อนเสมอ ไม่ปนกับข้อมูลทั่วไป */}
      {(allergies || aggressive) && (
        <div className="grid gap-2 sm:grid-cols-2">
          {allergies && (
            <Alert
              tone="rose"
              icon={HeartPulse}
              label={plain(t.register.allergiesLabel)}
              value={allergies}
            />
          )}
          {aggressive && (
            <Alert
              tone="amber"
              icon={AlertTriangle}
              label={plain(t.register.aggressiveNotesLabel)}
              value={aggressive}
            />
          )}
        </div>
      )}

      <dl className="grid gap-x-6 gap-y-3 sm:grid-cols-2">
        <Field
          icon={Smile}
          label={plain(t.register.personalityLabel)}
          value={pet.personality}
        />
        <Field
          icon={UtensilsCrossed}
          label={plain(t.register.foodNoteLabel)}
          value={pet.foodNote}
        />
        <Field
          icon={Pill}
          label={plain(t.register.medicationNoteLabel)}
          value={pet.medicationNote}
        />
        <Field
          icon={NotebookText}
          label={plain(t.register.noteLabel)}
          value={pet.note}
        />
      </dl>

      <div className="space-y-2">
        <div className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
          <Syringe className="h-3.5 w-3.5" />
          {t.customerPreview.vaccineTitle}
        </div>
        <div className="grid gap-2 sm:grid-cols-3">
          <DateTile
            label={plain(t.register.vaccine5in1Label)}
            date={pet.vaccine5in1At}
            t={t}
          />
          <DateTile
            label={plain(t.register.rabiesVaccineLabel)}
            date={pet.rabiesVaccineAt}
            t={t}
          />
          <DateTile
            label={t.customerPreview.fleaTick}
            date={pet.lastFleaTickAt}
            extra={pet.fleaTickMedicine}
            t={t}
          />
        </div>
      </div>

      <Thumbs
        photos={pet.vaccinePhotoUrls}
        label={t.customerPreview.vaccinePhotos}
        onZoom={onZoom}
        t={t}
      />
    </div>
  );
}

function Section({
  icon: Icon,
  title,
  children,
}: {
  icon: typeof UserRound;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section>
      <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold">
        <span className="flex h-6 w-6 items-center justify-center rounded-lg bg-primary/10 text-primary">
          <Icon className="h-3.5 w-3.5" />
        </span>
        {title}
      </h3>
      {children}
    </section>
  );
}

function Field({
  label,
  value,
  icon: Icon,
  wide = false,
}: {
  label: string;
  value: string | null | undefined;
  icon?: typeof UserRound;
  wide?: boolean;
}) {
  // ลูกค้าหลายคนพิมพ์ "-" หรือ "ไม่มี" ใส่ช่องบังคับ — ถือเป็นช่องว่าง ไม่ต้องโชว์ขีดเปล่าๆ (กฎเดียวกับอาการแพ้)
  const shown = allergyText(value);
  if (!shown) return null;
  return (
    <div className={cn("min-w-0", wide && "sm:col-span-2")}>
      <dt className="flex items-center gap-1 text-xs text-muted-foreground">
        {Icon && <Icon className="h-3.5 w-3.5" />}
        {label}
      </dt>
      <dd className="mt-0.5 text-sm break-words whitespace-pre-line">
        {value}
      </dd>
    </div>
  );
}

function Alert({
  tone,
  icon: Icon,
  label,
  value,
}: {
  tone: "rose" | "amber";
  icon: typeof UserRound;
  label: string;
  value: string;
}) {
  return (
    <div
      className={cn(
        "rounded-xl border p-3",
        tone === "rose"
          ? "border-rose-200 bg-rose-50 text-rose-800 dark:border-rose-900 dark:bg-rose-950/40 dark:text-rose-300"
          : "border-amber-200 bg-amber-50 text-amber-900 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-300",
      )}
    >
      <div className="flex items-center gap-1.5 text-xs font-semibold">
        <Icon className="h-3.5 w-3.5" />
        {label}
      </div>
      <p className="mt-1 text-sm break-words whitespace-pre-line">{value}</p>
    </div>
  );
}

function DateTile({
  label,
  date,
  extra,
  t,
}: {
  label: string;
  date: string | null;
  extra?: string | null;
  t: T;
}) {
  return (
    <div className="rounded-xl border bg-muted/30 p-3">
      <div className="text-[0.6875rem] leading-snug text-muted-foreground">
        {label}
      </div>
      <div
        className={cn(
          "mt-1 text-sm font-medium",
          !date && "text-muted-foreground",
        )}
      >
        {date ? formatDate(date) : t.customerPreview.notRecorded}
      </div>
      {extra && (
        <div className="truncate text-xs text-muted-foreground">{extra}</div>
      )}
    </div>
  );
}

function Thumbs({
  photos,
  label,
  onZoom,
  t,
}: {
  photos: string[];
  label: string;
  onZoom: (src: string) => void;
  t: T;
}) {
  return (
    <div className="space-y-2">
      <div className="text-xs font-medium text-muted-foreground">{label}</div>
      {photos.length === 0 ? (
        <Empty t={t} />
      ) : (
        <div className="flex gap-2 overflow-x-auto pb-1">
          {photos.map((src, i) => (
            <button
              key={i}
              type="button"
              onClick={() => onZoom(src)}
              className="h-20 w-20 shrink-0 overflow-hidden rounded-xl ring-1 ring-border transition hover:ring-2 hover:ring-primary"
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={src}
                alt={label}
                className="h-full w-full object-cover"
              />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function Empty({ t }: { t: T }) {
  return <p className="text-xs text-muted-foreground">{t.register.noPhotos}</p>;
}
