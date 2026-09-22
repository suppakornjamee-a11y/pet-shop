"use client";

import { useCallback, useEffect, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  CalendarDays,
  ChevronLeft,
  Home,
  Info,
  Loader2,
  Plus,
  Scissors,
  ShoppingBag,
  Sparkles,
} from "lucide-react";
import {
  getBookableRooms,
  getBookableServices,
  getFleaTickCatalog,
  liffGetBookingContext,
  liffRegisterCustomer,
  liffSaveQuickProfile,
  liffSubmitBookingRequest,
} from "@/app/actions/liff";
import type { FleaTickProductInfo } from "@/lib/flea-tick";
import { fleaInfoChanged } from "@/lib/flea-tick-check";
import { formatBaht } from "@/lib/format";
import { cn } from "@/lib/utils";
import { useLiff, LiffGate, handleLiffAuthExpiry } from "@/components/liff-provider";
import { useI18n } from "@/components/i18n-provider";
import { RegisterForm } from "@/components/register-form";
import { LiffTabs } from "@/components/liff-tabs";
import { SpeciesIcon } from "@/components/species-icon";
import { Button } from "@/components/ui/button";
import {
  AddPetButton,
  ExistingPetFields,
  OwnerFields,
  PetFields,
  emptyPetDraft,
  fleaDeclarationOf,
  focusField,
  petDraftToInput,
  splitDetail,
  validateExistingPet,
  validateOwner,
  validatePet,
  type FieldError,
  type OwnerDraft,
  type PetDraft,
} from "./pet-quick-form";
import { ItemDetail, draftReady, whenLabel } from "./item-detail";
import { validateFleaForDraft } from "./flea-section";
import { fleaDataOf } from "./flea-validation";
import {
  entryToPayload,
  estimateDraft,
  forSpecies,
  loadCart,
  newItemDraft,
  saveCart,
  type CartEntry,
  type FleaDraft,
  type ItemDraft,
} from "./cart";
import { CARD, Stepper, type CtxPet, type Kind, type Room, type Service, type T } from "./shared";

const KIND_ORDER: Kind[] = ["BATH", "BOARDING", "OTHER"];
const KIND_ICONS: Record<Kind, typeof Home> = { BOARDING: Home, BATH: Scissors, OTHER: Sparkles };

type Ctx =
  | { linked: false }
  | { linked: true; customer: { id: string; name: string; phone: string; petInstagram: string | null }; pets: CtxPet[] };

type Stage = "start" | "detail" | "cart";

function petToDraft(p: CtxPet): PetDraft {
  const allergy = splitDetail(p.allergies);
  const caution = splitDetail(p.groomingCautions);
  return {
    id: p.id,
    name: p.name,
    species: p.species,
    breed: p.breed ?? "",
    birthDate: p.birthDate,
    weightKg: p.weightKg ? String(p.weightKg) : "",
    hasAllergies: allergy.has,
    allergies: allergy.note,
    hasCautions: caution.has,
    groomingCautions: caution.note,
    hasChronicDisease: p.hasChronicDisease == null ? "" : p.hasChronicDisease ? "yes" : "no",
    chronicDiseaseNote: p.chronicDiseaseNote ?? "",
    fleaTickMedicine: p.fleaTickMedicine ?? "",
    fleaTickProductId: p.fleaTickProductId,
    lastFleaTickDate: p.lastFleaTickAt,
    fleaEvidence: [],
    infoStatus: "",
  };
}

/** แถบปุ่มที่แปะขอบล่างจอ — summary = ข้อความสรุปด้านซ้าย (เช่น ยอดโดยประมาณ) · aboveTabs = ยกขึ้นเหนือแถบเมนูล่าง */
function BottomBar({
  summary,
  aboveTabs = false,
  children,
}: {
  summary?: React.ReactNode;
  aboveTabs?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div
      className={cn(
        "fixed inset-x-3 z-10 mx-auto max-w-md sm:max-w-xl md:max-w-2xl lg:max-w-3xl",
        aboveTabs ? "bottom-[calc(4.5rem+env(safe-area-inset-bottom))]" : "bottom-3"
      )}
    >
      <div className="flex items-center gap-3 rounded-3xl border bg-card/95 p-2 shadow-[0_8px_24px_rgba(190,60,110,0.16)] backdrop-blur">
        {summary && <div className="min-w-0 shrink-0 pl-2">{summary}</div>}
        <div className="min-w-0 flex-1">{children}</div>
      </div>
    </div>
  );
}

/** แถบหัวของหน้าย่อย — ปุ่มย้อนกลับกลมทางซ้าย ชื่อหน้ากึ่งกลาง */
function AppBar({ title, onBack, t }: { title: string; onBack: () => void; t: T }) {
  return (
    <div className="relative flex h-11 items-center justify-center">
      <button
        type="button"
        onClick={onBack}
        aria-label={t.liff.backButton}
        className="absolute left-0 flex h-10 w-10 items-center justify-center rounded-full border bg-card shadow-sm transition-colors hover:bg-muted"
      >
        <ChevronLeft className="h-5 w-5" />
      </button>
      <h1 className="px-12 text-center text-base font-bold">{title}</h1>
    </div>
  );
}

function BookingBody() {
  const { t } = useI18n();
  const router = useRouter();
  const { idToken } = useLiff();
  const [isPending, startTransition] = useTransition();

  const [ctx, setCtx] = useState<Ctx | null>(null);
  const [servicesByKind, setServicesByKind] = useState<Record<Kind, Service[]> | null>(null);
  const [rooms, setRooms] = useState<Room[]>([]);
  const [catalog, setCatalog] = useState<FleaTickProductInfo[]>([]);

  const [stage, setStage] = useState<Stage>("start");
  const [kind, setKind] = useState<Kind | null>(null);
  const [cart, setCart] = useState<CartEntry[]>([]);

  // หน้าแรก: ฟอร์มลูกค้าใหม่ (อาบน้ำ) / เลือกสัตว์เลี้ยงของลูกค้าเดิม
  const [owner, setOwner] = useState<OwnerDraft>({ name: "", phone: "", petInstagram: "" });
  const [newPets, setNewPets] = useState<PetDraft[]>([emptyPetDraft()]);
  const [selectedPetId, setSelectedPetId] = useState<string>("");
  const [petEdits, setPetEdits] = useState<Record<string, PetDraft>>({});

  // ช่องแรกที่ยังกรอกไม่ครบตอนกดถัดไป — ขึ้นขอบแดงและโฟกัสให้
  const [invalidId, setInvalidId] = useState<string | null>(null);

  // หน้ารายละเอียดรายการ
  const [draft, setDraft] = useState<ItemDraft | null>(null);
  const [editingKey, setEditingKey] = useState<string | null>(null);

  const loadContext = useCallback(async () => {
    if (!idToken) return;
    const res = await liffGetBookingContext(idToken);
    if (!res.ok) {
      handleLiffAuthExpiry(res);
      toast.error(res.error);
      return;
    }
    if (!res.linked) {
      setCtx({ linked: false });
      return;
    }
    const pets = res.pets as CtxPet[];
    setCtx({ linked: true, customer: res.customer, pets });
    setPetEdits(Object.fromEntries(pets.map((p) => [p.id, petToDraft(p)])));
    setSelectedPetId((cur) => (cur && (cur === "new" || pets.some((p) => p.id === cur)) ? cur : (pets[0]?.id ?? "new")));
    setCart(loadCart(res.customer.id));
  }, [idToken]);

  useEffect(() => {
    const id = setTimeout(() => void loadContext(), 0);
    return () => clearTimeout(id);
  }, [loadContext]);

  useEffect(() => {
    Promise.all([
      getBookableServices("BATH"),
      getBookableServices("OTHER"),
      getBookableServices("BOARDING"),
      getBookableRooms(),
      getFleaTickCatalog(),
    ]).then(([bath, other, boarding, roomList, products]) => {
      setServicesByKind({ BATH: bath, OTHER: other, BOARDING: boarding });
      setRooms(roomList);
      setCatalog(products);
    });
  }, []);

  const customerId = ctx?.linked ? ctx.customer.id : null;
  function updateCart(next: CartEntry[]) {
    setCart(next);
    if (customerId) saveCart(customerId, next);
  }

  const pets = useMemo(() => (ctx?.linked ? ctx.pets : []), [ctx]);
  const draftPet = draft ? pets.find((p) => p.id === draft.petId) : undefined;
  const draftServices = useMemo(
    () => (draft && servicesByKind ? forSpecies(servicesByKind[draft.kind], draftPet?.species) : []),
    [draft, servicesByKind, draftPet]
  );

  function openDetail(k: Kind, petId: string, petInfo: ItemDraft["petInfo"] = "", flea: FleaDraft | null = null) {
    setInvalidId(null);
    setDraft({ ...newItemDraft(k, petId), petInfo, ...(flea ? { flea } : {}) });
    setEditingKey(null);
    setStage("detail");
    window.scrollTo({ top: 0 });
  }

  function chooseKind(k: Kind) {
    setKind(k);
    if (k === "BATH" && selectedPetId === "") setSelectedPetId(pets[0]?.id ?? "new");
  }

  /* ---------- ปุ่มถัดไปของหน้าแรก ---------- */

  /** ชี้ช่องที่ยังไม่ครบให้ลูกค้าเห็น แล้วบอกว่ายังส่งไม่ได้ */
  function reject(err: FieldError) {
    setInvalidId(err.id);
    focusField(err.id);
    toast.error(err.message);
  }

  function nextFromStart() {
    if (!kind || !idToken || !ctx) return;
    setInvalidId(null);
    if (!ctx.linked) {
      // ลูกค้าใหม่ + อาบน้ำ: บันทึกฟอร์มสั้น (ผูก LINE นี้ให้) แล้วไปหน้ารายการของตัวแรก
      const ownerError = validateOwner(owner, t);
      if (ownerError) return reject(ownerError);
      for (const [i, pet] of newPets.entries()) {
        const petError = validatePet(pet, i, t);
        if (petError) return reject(petError);
      }
      startTransition(async () => {
        const res = await liffSaveQuickProfile(idToken, {
          customer: owner,
          pets: newPets.map((pet) => petDraftToInput(pet, t.liffBook.diseaseNo)),
        });
        if (!res.ok) {
          handleLiffAuthExpiry(res);
          toast.error(res.error);
          return;
        }
        await loadContext();
        openDetail("BATH", res.petIds[0], "NEW");
      });
      return;
    }
    if (kind !== "BATH") {
      if (selectedPetId && selectedPetId !== "new") openDetail(kind, selectedPetId);
      return;
    }
    const isNewPet = selectedPetId === "new";
    const petDraft = isNewPet ? newPets[0] : petEdits[selectedPetId];
    if (!petDraft) return;
    const original = isNewPet ? undefined : pets.find((p) => p.id === petDraft.id);
    const petError = isNewPet ? validatePet(petDraft, 0, t) : validateExistingPet(petDraft, original, catalog, t);
    if (petError) return reject(petError);
    // สัตว์เดิมที่แก้ข้อมูลยาเห็บหมัด: ยังไม่บันทึกลงสัตว์เลี้ยงที่ขั้นนี้ — ส่งต่อเป็นคำตอบ "แจ้งข้อมูลยาใหม่" ของรายการ
    // เพื่อให้เซิร์ฟเวอร์ตรวจ + เก็บหลักฐาน + จดผลลงประวัติออเดอร์ตอนส่งคำขอ (ทางเดียวกับส่วนตรวจยาตอนเลือกวันเวลา)
    let fleaInit: FleaDraft | null = null;
    if (original && petDraft.infoStatus === "update") {
      const declaration = fleaDeclarationOf(petDraft);
      if (fleaInfoChanged(fleaDataOf(original), declaration)) fleaInit = { choice: "declare", ...declaration };
    }
    // สัตว์เดิมที่ลูกค้ายืนยันว่าข้อมูลถูกต้อง: บันทึกแค่น้ำหนักล่าสุด — นอกนั้นบันทึกเต็มชุดเหมือนเดิม
    const confirmSame = !isNewPet && petDraft.infoStatus === "same";
    startTransition(async () => {
      const res = await liffSaveQuickProfile(
        idToken,
        confirmSame
          ? { confirmed: [{ id: petDraft.id, weightKg: petDraft.weightKg }] }
          : { pets: [petDraftToInput(petDraft, t.liffBook.diseaseNo)] }
      );
      if (!res.ok) {
        handleLiffAuthExpiry(res);
        toast.error(res.error);
        return;
      }
      await loadContext();
      if (isNewPet) {
        setNewPets([emptyPetDraft()]);
        setSelectedPetId(res.petIds[0]);
      }
      openDetail("BATH", res.petIds[0], isNewPet ? "NEW" : confirmSame ? "SAME" : "UPDATED", fleaInit);
    });
  }

  /* ---------- ตะกร้า ---------- */

  function addToCart() {
    if (!draft || !draftPet) return;
    const est = estimateDraft(draft, draftServices, rooms);
    const entry: CartEntry = {
      key: editingKey ?? `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      draft,
      petName: draftPet.name,
      species: draftPet.species,
      serviceNames: est.serviceNames,
      roomLabel: est.room ? `${est.room.category.name} · ${est.room.name}` : null,
      nights: est.nights,
      estimate: est.estimate,
      deposit: est.deposit,
      dueNow: est.dueNow,
    };
    updateCart(editingKey ? cart.map((e) => (e.key === editingKey ? entry : e)) : [...cart, entry]);
    setDraft(null);
    setEditingKey(null);
    setStage("cart");
    window.scrollTo({ top: 0 });
  }

  /** ก่อนเพิ่มลงรายการจอง: ตรวจคำตอบเรื่องยาเห็บหมัด ถ้ายังไม่ครบชี้ช่องให้ */
  function addChecked() {
    if (!draft || !draftPet) return;
    const err = validateFleaForDraft(draft, draftPet, catalog, t);
    if (err) return reject(err);
    setInvalidId(null);
    addToCart();
  }

  function editEntry(e: CartEntry) {
    setInvalidId(null);
    setDraft(e.draft);
    setEditingKey(e.key);
    setStage("detail");
    window.scrollTo({ top: 0 });
  }

  function submit() {
    if (!idToken || cart.length === 0) return;
    startTransition(async () => {
      const res = await liffSubmitBookingRequest(idToken, { items: cart.map(entryToPayload) });
      if (!res.ok) {
        handleLiffAuthExpiry(res);
        const item = "itemIndex" in res && res.itemIndex !== undefined ? cart[res.itemIndex] : undefined;
        toast.error(item ? `${item.petName} · ${t.liffBook.kind[item.draft.kind]}: ${res.error}` : res.error);
        return;
      }
      updateCart([]);
      router.push(`/liff/requests/${res.id}`);
    });
  }

  if (!ctx || !servicesByKind) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  /* ---------- หน้ารายละเอียดรายการ ---------- */
  if (stage === "detail" && draft && draftPet && idToken) {
    const KindIcon = KIND_ICONS[draft.kind];
    const petMeta = [draftPet.breed, draftPet.weightKg ? `${draftPet.weightKg} ${t.liffBook.weightUnit}` : null]
      .filter(Boolean)
      .join(" · ");
    return (
      <div className="space-y-4 pb-28">
        <AppBar title={t.liffBook.detailTitle} onBack={() => setStage(editingKey ? "cart" : "start")} t={t} />
        <div className={cn("flex items-center gap-3 p-3.5", CARD)}>
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-primary/10 text-primary">
            <KindIcon className="h-5 w-5" />
          </span>
          <div className="min-w-0 flex-1">
            <div className="font-bold leading-tight">{t.liffBook.kind[draft.kind]}</div>
            <div className="mt-0.5 flex items-center gap-1 text-xs text-muted-foreground">
              <SpeciesIcon species={draftPet.species} className="h-3.5 w-3.5 shrink-0" />
              <span className="min-w-0 truncate">
                {draftPet.name}
                {petMeta && ` (${petMeta})`}
              </span>
            </div>
          </div>
        </div>

        <ItemDetail
          draft={draft}
          onChange={setDraft}
          pet={draftPet}
          catalog={catalog}
          invalidId={invalidId}
          services={draftServices}
          rooms={rooms}
          t={t}
        />

        <BottomBar
          summary={
            <div className="leading-tight">
              <div className="text-[0.6875rem] text-muted-foreground">{t.liffBook.estimateShort}</div>
              <div className="text-lg font-bold tabular-nums text-primary">
                {formatBaht(estimateDraft(draft, draftServices, rooms).estimate)}
              </div>
            </div>
          }
        >
          <Button
            className="h-12 w-full rounded-2xl text-base font-semibold shadow-md"
            disabled={!draftReady(draft, draftServices, rooms)}
            onClick={addChecked}
          >
            {t.common.confirm}
          </Button>
        </BottomBar>
      </div>
    );
  }

  /* ---------- ตะกร้า ---------- */
  if (stage === "cart") {
    const totalEstimate = cart.reduce((sum, e) => sum + e.estimate, 0);
    const totalDue = cart.reduce((sum, e) => sum + e.dueNow, 0);
    const remaining = Math.max(0, totalEstimate - totalDue);
    // ป้าย "(มัดจำ N ตัว)" ใช้ได้เฉพาะเมื่อทุกรายการเป็นงานอาบน้ำที่จ่ายแค่มัดจำตอนแรก
    const depositCount = cart.filter((e) => e.deposit > 0).length;
    const allBath = cart.length > 0 && cart.every((e) => e.draft.kind === "BATH");
    const petOrder = new Map(pets.map((p, i) => [p.id, i]));
    const sorted = [...cart].sort((a, b) => (petOrder.get(a.draft.petId) ?? 99) - (petOrder.get(b.draft.petId) ?? 99));
    return (
      <div className="space-y-4 pb-28">
        <AppBar title={t.liffBook.cartTitleCount(cart.length)} onBack={() => setStage("start")} t={t} />

        {sorted.length === 0 ? (
          <p className="py-8 text-center text-sm text-muted-foreground">{t.liffBook.cartEmpty}</p>
        ) : (
          <div className="space-y-3">
            {sorted.map((e) => (
              <div key={e.key} className={cn("space-y-3 p-4", CARD)}>
                <div className="flex items-start gap-3">
                  <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                    <SpeciesIcon species={e.species} className="h-6 w-6" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="font-bold leading-tight">
                      {e.petName} · {t.liffBook.kind[e.draft.kind]}
                    </div>
                    {(e.roomLabel || e.serviceNames.length > 0) && (
                      <div className="mt-0.5 text-xs text-muted-foreground">
                        {[e.roomLabel, ...e.serviceNames].filter(Boolean).join(" · ")}
                      </div>
                    )}
                    {e.draft.kind === "BATH" && e.draft.styleNote && (
                      <div className="mt-0.5 text-xs text-muted-foreground">
                        {t.liffBook.styleTitle}: {e.draft.styleNote}
                      </div>
                    )}
                  </div>
                  <div className="shrink-0 font-bold tabular-nums text-primary">{formatBaht(e.estimate)}</div>
                </div>
                <div className="flex items-center gap-2 rounded-2xl bg-primary/5 px-3 py-2 text-xs">
                  <CalendarDays className="h-4 w-4 shrink-0 text-muted-foreground" />
                  <span className="min-w-0 flex-1">{whenLabel(e.draft, t).join(" · ")}</span>
                  <button type="button" className="font-semibold text-primary" onClick={() => editEntry(e)}>
                    {t.liffBook.edit}
                  </button>
                  <span aria-hidden className="h-3 w-px bg-border" />
                  <button
                    type="button"
                    className="text-muted-foreground"
                    onClick={() => updateCart(cart.filter((x) => x.key !== e.key))}
                  >
                    {t.liffBook.remove}
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        <div className="grid grid-cols-2 gap-2">
          {[
            { label: t.liffBook.addAnotherPet, kind: "BATH" as const, dashed: true },
            { label: t.liffBook.addOtherService, kind: null, dashed: false },
          ].map((b) => (
            <Button
              key={b.label}
              variant="outline"
              className={cn(
                "h-11 min-w-0 gap-1.5 rounded-2xl bg-card px-2 text-[0.8125rem] sm:text-sm",
                b.dashed ? "border-dashed border-primary/50 text-primary hover:text-primary" : "text-foreground/80"
              )}
              onClick={() => {
                setKind(b.kind);
                setStage("start");
              }}
            >
              <Plus className="h-4 w-4 shrink-0" />
              <span className="truncate">{b.label}</span>
            </Button>
          ))}
        </div>

        {cart.length > 0 && (
          <div className={cn("space-y-3 p-4", CARD)}>
            <h2 className="text-base font-bold">{t.liffBook.summaryTitle}</h2>
            <div className="space-y-2 text-sm">
              <div className="flex items-baseline justify-between gap-3">
                <span>{allBath && depositCount > 0 ? t.liffBook.dueDeposit(depositCount) : t.liffBook.dueAfterApproval}</span>
                <span className="font-bold tabular-nums text-primary">{formatBaht(totalDue)}</span>
              </div>
              {remaining > 0 && (
                <div className="flex items-baseline justify-between gap-3 text-muted-foreground">
                  <span>{t.liffBook.remainingAtShop}</span>
                  <span className="tabular-nums">{formatBaht(remaining)}</span>
                </div>
              )}
            </div>
            <div className="flex items-baseline justify-between gap-3 border-t pt-3">
              <span className="font-bold">{t.liffBook.estimate}</span>
              <span className="text-2xl font-bold tabular-nums text-primary">{formatBaht(totalEstimate)}</span>
            </div>
          </div>
        )}

        {cart.length > 0 && (
          <div className="flex items-start gap-2.5 rounded-2xl bg-amber-50 p-3.5 text-amber-900">
            <Info className="mt-0.5 h-4 w-4 shrink-0 text-amber-500" />
            <p className="min-w-0 flex-1 text-xs leading-relaxed">{t.liffBook.confirmNotice}</p>
          </div>
        )}

        {cart.length > 0 && (
          <BottomBar>
            <Button className="h-12 w-full rounded-2xl text-base font-semibold shadow-md" disabled={isPending} onClick={submit}>
              {isPending && <Loader2 className="animate-spin" />}
              {t.common.confirm}
            </Button>
          </BottomBar>
        )}
      </div>
    );
  }

  /* ---------- หน้าแรก: เลือกบริการ + ข้อมูลเจ้าของ/สัตว์เลี้ยง ---------- */
  const showRegister = !ctx.linked && kind !== null && kind !== "BATH";
  const canNext =
    !!kind &&
    (ctx.linked
      ? kind === "BATH"
        ? !!selectedPetId
        : !!selectedPetId && selectedPetId !== "new"
      : kind === "BATH");

  return (
    <div className="space-y-5 pb-44">
      <div className="relative flex items-center justify-center">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/images/logo-light.png" alt={t.liff.bookPageTitle} className="h-14 w-auto" />
        {cart.length > 0 && (
          <button
            type="button"
            onClick={() => setStage("cart")}
            aria-label={t.liffBook.viewCart(cart.length)}
            className="absolute right-0 flex h-11 w-11 items-center justify-center rounded-2xl border bg-card shadow-sm transition-colors hover:bg-muted"
          >
            <ShoppingBag className="h-5 w-5" />
            <span className="absolute -right-1.5 -top-1.5 flex h-5 min-w-5 items-center justify-center rounded-full bg-primary px-1 text-[0.625rem] font-semibold text-primary-foreground">
              {cart.length}
            </span>
          </button>
        )}
      </div>

      <div className={cn("p-4", CARD)}>
        <div className="mb-3">
          <span className="text-sm font-bold">{t.liffBook.stepsTitle}</span>
        </div>
        <Stepper step={1} t={t} />
      </div>

      <div className="flex items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold leading-tight">{t.liff.chooseServiceTitle}</h1>
        </div>
        <span className="shrink-0 pb-0.5 text-xs text-muted-foreground">{t.liffBook.stepNumber(1)}</span>
      </div>

      <div className="grid grid-cols-3 gap-2.5">
        {KIND_ORDER.map((k) => {
          const Icon = KIND_ICONS[k];
          const active = kind === k;
          return (
            <button
              key={k}
              type="button"
              onClick={() => chooseKind(k)}
              className={cn(
                "flex flex-col items-start gap-2 rounded-3xl border-2 p-3 text-left transition-colors",
                active ? "border-primary bg-primary/5" : "border-border bg-card"
              )}
            >
              <span
                className={cn(
                  "flex h-10 w-10 items-center justify-center rounded-xl transition-colors",
                  active
                    ? "bg-primary text-primary-foreground"
                    : k === "OTHER"
                      ? "bg-amber-100 text-amber-600"
                      : "bg-primary/10 text-primary"
                )}
              >
                <Icon className="h-5 w-5" />
              </span>
              <span className={cn("text-sm font-bold leading-tight", active && "text-primary")}>
                {t.liffBook.kind[k]}
              </span>
            </button>
          );
        })}
      </div>

      {kind && !ctx.linked && kind === "BATH" && (
        <div className="space-y-4">
          <OwnerFields owner={owner} onChange={setOwner} invalidId={invalidId} t={t} />
          {newPets.map((p, i) => (
            <PetFields
              key={i}
              pet={p}
              index={i}
              catalog={catalog}
              onChange={(v) => setNewPets(newPets.map((x, j) => (j === i ? v : x)))}
              onRemove={newPets.length > 1 ? () => setNewPets(newPets.filter((_, j) => j !== i)) : undefined}
              invalidId={invalidId}
              t={t}
            />
          ))}
          <AddPetButton onClick={() => setNewPets([...newPets, emptyPetDraft()])} t={t} />
        </div>
      )}

      {showRegister && idToken && (
        <RegisterForm
          onSubmit={async ({ customer, pets: petsInput }) => {
            const res = await liffRegisterCustomer(idToken, { customer, pets: petsInput });
            if (!res.ok) handleLiffAuthExpiry(res);
            return res;
          }}
          onSuccess={() => void loadContext()}
        />
      )}

      {kind && ctx.linked && (
        <div className={cn("space-y-4 p-4", CARD)}>
          <div>
            <h2 className="text-base font-bold">{t.liffBook.petSectionTitle}</h2>
            <p className="text-xs text-muted-foreground">{t.liffBook.petSectionHint}</p>
          </div>

          {pets.length > 0 || kind === "BATH" ? (
            <div className="flex flex-wrap gap-2">
              {pets.map((p) => {
                const on = selectedPetId === p.id;
                return (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => setSelectedPetId(p.id)}
                    className={cn(
                      "flex items-center gap-1.5 rounded-full border py-1 pl-1 pr-3 text-xs transition-colors",
                      on ? "border-primary bg-primary font-semibold text-primary-foreground" : "bg-card hover:bg-muted"
                    )}
                  >
                    <span
                      className={cn(
                        "flex h-5 w-5 items-center justify-center rounded-full",
                        on ? "bg-white/25 text-primary-foreground" : "bg-primary/10 text-primary"
                      )}
                    >
                      <SpeciesIcon species={p.species} className="h-3 w-3" />
                    </span>
                    {p.name}
                  </button>
                );
              })}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">{t.liff.noPetsFound}</p>
          )}

          {kind === "BATH" &&
            (selectedPetId === "new" ? (
              <PetFields
                pet={newPets[0]}
                index={0}
                catalog={catalog}
                onChange={(v) => setNewPets([v])}
                invalidId={invalidId}
                bare
                t={t}
              />
            ) : (
              petEdits[selectedPetId] && (
                <ExistingPetFields
                  key={selectedPetId}
                  pet={petEdits[selectedPetId]}
                  catalog={catalog}
                  onChange={(v) => setPetEdits({ ...petEdits, [selectedPetId]: v })}
                  invalidId={invalidId}
                  t={t}
                />
              )
            ))}
          {kind === "BATH" && selectedPetId !== "new" && (
            <AddPetButton
              onClick={() => {
                setNewPets([emptyPetDraft()]);
                setSelectedPetId("new");
              }}
              t={t}
            />
          )}
        </div>
      )}

      {kind && !showRegister && (
        <BottomBar aboveTabs={ctx.linked}>
          <Button
            className="h-12 w-full rounded-2xl text-base font-semibold shadow-md"
            disabled={!canNext || isPending}
            onClick={nextFromStart}
          >
            {isPending && <Loader2 className="animate-spin" />}
            {t.common.confirm}
          </Button>
        </BottomBar>
      )}

      {ctx.linked && <LiffTabs />}
    </div>
  );
}

export function LiffBookingApp() {
  return (
    <LiffGate>
      <BookingBody />
    </LiffGate>
  );
}
