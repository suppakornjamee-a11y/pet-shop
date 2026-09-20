"use client";

import { useCallback, useEffect, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { ArrowLeft, Bath, Home, Loader2, Pencil, Plus, Scissors, ShoppingBag, Trash2 } from "lucide-react";
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
import { formatBaht } from "@/lib/format";
import { cn } from "@/lib/utils";
import { useLiff, LiffGate, handleLiffAuthExpiry } from "@/components/liff-provider";
import { useI18n } from "@/components/i18n-provider";
import { RegisterForm } from "@/components/register-form";
import { SpeciesIcon } from "@/components/species-icon";
import { Button } from "@/components/ui/button";
import {
  AddPetButton,
  ExistingPetFields,
  OwnerFields,
  PetFields,
  emptyPetDraft,
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
import { ItemDetail, ReviewDialog, draftReady, whenLabel } from "./item-detail";
import { validateFleaForDraft } from "./flea-section";
import {
  entryToPayload,
  estimateDraft,
  forSpecies,
  loadCart,
  newItemDraft,
  saveCart,
  type CartEntry,
  type ItemDraft,
} from "./cart";
import { Stepper, type CtxPet, type Kind, type Room, type Service, type T } from "./shared";

const KIND_ORDER: Kind[] = ["BOARDING", "BATH", "OTHER"];
const KIND_ICONS: Record<Kind, typeof Home> = { BOARDING: Home, BATH: Bath, OTHER: Scissors };

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
    infoStatus: "",
  };
}

function BottomBar({ children }: { children: React.ReactNode }) {
  return (
    <div className="fixed inset-x-3 bottom-3 z-10 mx-auto max-w-md sm:max-w-xl md:max-w-2xl lg:max-w-3xl">{children}</div>
  );
}

function Header({ onBack, cartCount, onCart, t }: { onBack?: () => void; cartCount: number; onCart?: () => void; t: T }) {
  return (
    <div className="flex items-start gap-3">
      {onBack && (
        <button
          type="button"
          onClick={onBack}
          aria-label={t.liff.backButton}
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border bg-card transition-colors hover:bg-muted"
        >
          <ArrowLeft className="h-4 w-4" />
        </button>
      )}
      <div className="min-w-0 flex-1">
        <Stepper step={1} t={t} />
      </div>
      {onCart && cartCount > 0 && (
        <button
          type="button"
          onClick={onCart}
          aria-label={t.liffBook.viewCart(cartCount)}
          className="relative flex h-10 w-10 shrink-0 items-center justify-center rounded-full border bg-card transition-colors hover:bg-muted"
        >
          <ShoppingBag className="h-4 w-4" />
          <span className="absolute -right-1 -top-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-primary px-1 text-[0.625rem] font-semibold text-primary-foreground">
            {cartCount}
          </span>
        </button>
      )}
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
  const [reviewOpen, setReviewOpen] = useState(false);

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

  function openDetail(k: Kind, petId: string, petInfo: ItemDraft["petInfo"] = "") {
    setInvalidId(null);
    setDraft({ ...newItemDraft(k, petId), petInfo });
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
    const petError = isNewPet ? validatePet(petDraft, 0, t) : validateExistingPet(petDraft, t);
    if (petError) return reject(petError);
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
      openDetail("BATH", res.petIds[0], isNewPet ? "NEW" : confirmSame ? "SAME" : "UPDATED");
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
    setReviewOpen(false);
    setDraft(null);
    setEditingKey(null);
    setStage("cart");
    window.scrollTo({ top: 0 });
  }

  /** ก่อนเปิดหน้าต่างตรวจสอบรายการ: ตรวจคำตอบเรื่องยาเห็บหมัด ถ้ายังไม่ครบชี้ช่องให้ */
  function openReview() {
    if (!draft || !draftPet) return;
    const err = validateFleaForDraft(draft, draftPet, catalog, t);
    if (err) return reject(err);
    setInvalidId(null);
    setReviewOpen(true);
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
    return (
      <div className="space-y-4 pb-28">
        <Header onBack={() => setStage(editingKey ? "cart" : "start")} cartCount={cart.length} t={t} />
        <div className="flex items-center gap-3 rounded-2xl border bg-card p-3">
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-accent/40">
            <KindIcon className="h-5 w-5 text-primary" />
          </span>
          <div className="min-w-0 flex-1">
            <div className="font-semibold">{t.liffBook.kind[draft.kind]}</div>
            <div className="flex items-center gap-1 text-xs text-muted-foreground">
              <SpeciesIcon species={draftPet.species} className="h-3.5 w-3.5" /> {draftPet.name}
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

        <ReviewDialog
          open={reviewOpen}
          onOpenChange={setReviewOpen}
          draft={draft}
          pet={draftPet}
          services={draftServices}
          rooms={rooms}
          onConfirm={addToCart}
          t={t}
        />

        <BottomBar>
          <Button
            className="h-14 w-full rounded-2xl text-base"
            disabled={!draftReady(draft, draftServices, rooms)}
            onClick={openReview}
          >
            {t.liffBook.review}
          </Button>
        </BottomBar>
      </div>
    );
  }

  /* ---------- ตะกร้า ---------- */
  if (stage === "cart") {
    const totalEstimate = cart.reduce((s, e) => s + e.estimate, 0);
    const totalDue = cart.reduce((s, e) => s + e.dueNow, 0);
    const petOrder = new Map(pets.map((p, i) => [p.id, i]));
    const sorted = [...cart].sort((a, b) => (petOrder.get(a.draft.petId) ?? 99) - (petOrder.get(b.draft.petId) ?? 99));
    return (
      <div className="space-y-4 pb-28">
        <Header onBack={() => setStage("start")} cartCount={0} t={t} />
        <h1 className="text-lg font-bold">{t.liffBook.cartTitle}</h1>

        {sorted.length === 0 ? (
          <p className="py-8 text-center text-sm text-muted-foreground">{t.liffBook.cartEmpty}</p>
        ) : (
          <div className="space-y-3">
            {sorted.map((e) => {
              const Icon = KIND_ICONS[e.draft.kind];
              return (
                <div key={e.key} className="rounded-2xl border bg-card p-4">
                  <div className="flex items-start gap-3">
                    <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-accent/40">
                      <Icon className="h-5 w-5 text-primary" />
                    </span>
                    <div className="min-w-0 flex-1 space-y-0.5 text-sm">
                      <div className="flex items-center gap-1 font-semibold">
                        <SpeciesIcon species={e.species} className="h-4 w-4" /> {e.petName} · {t.liffBook.kind[e.draft.kind]}
                      </div>
                      {e.roomLabel && <div>{e.roomLabel}</div>}
                      {e.serviceNames.length > 0 && <div className="text-muted-foreground">{e.serviceNames.join(" · ")}</div>}
                      {e.draft.kind === "BATH" && e.draft.styleNote && (
                        <div className="text-muted-foreground">
                          {t.liffBook.styleTitle}: {e.draft.styleNote}
                        </div>
                      )}
                      {whenLabel(e.draft, t).map((l) => (
                        <div key={l}>{l}</div>
                      ))}
                    </div>
                  </div>
                  <div className="mt-3 flex items-center justify-between gap-3 border-t border-dashed pt-3 text-sm">
                    <div>
                      <div>
                        {t.liffBook.estimate} <span className="font-semibold">{formatBaht(e.estimate)}</span>
                      </div>
                      {e.deposit > 0 && <div className="text-xs text-muted-foreground">{t.liffBook.bathDeposit}</div>}
                    </div>
                    <div className="flex shrink-0 gap-1">
                      <Button variant="outline" size="sm" className="rounded-xl" onClick={() => editEntry(e)}>
                        <Pencil className="h-3.5 w-3.5" /> {t.liffBook.edit}
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        className="rounded-xl text-destructive"
                        onClick={() => updateCart(cart.filter((x) => x.key !== e.key))}
                      >
                        <Trash2 className="h-3.5 w-3.5" /> {t.liffBook.remove}
                      </Button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        <div className="grid gap-2 sm:grid-cols-2">
          <Button
            variant="outline"
            className="h-12 rounded-2xl"
            onClick={() => {
              setKind("BATH");
              setStage("start");
            }}
          >
            <Plus className="h-4 w-4" /> {t.liffBook.addAnotherPet}
          </Button>
          <Button
            variant="outline"
            className="h-12 rounded-2xl"
            onClick={() => {
              setKind(null);
              setStage("start");
            }}
          >
            <Plus className="h-4 w-4" /> {t.liffBook.addOtherService}
          </Button>
        </div>

        {cart.length > 0 && (
          <div className="space-y-2 rounded-2xl border bg-card p-4 text-sm">
            <div className="flex justify-between gap-3">
              <span>{t.liffBook.estimate}</span>
              <span className="font-semibold">{formatBaht(totalEstimate)}</span>
            </div>
            <div className="flex justify-between gap-3">
              <span>{t.liffBook.dueAfterApproval}</span>
              <span className="text-lg font-bold text-primary">{formatBaht(totalDue)}</span>
            </div>
            <p className="text-xs text-muted-foreground">{t.liffBook.confirmNotice}</p>
          </div>
        )}

        {cart.length > 0 && (
          <BottomBar>
            <Button className="h-14 w-full rounded-2xl text-base" disabled={isPending} onClick={submit}>
              {isPending && <Loader2 className="animate-spin" />}
              {t.liffBook.submit}
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
    <div className="space-y-5 pb-28">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src="/images/logo-light.png" alt={t.liff.bookPageTitle} className="mx-auto h-20 w-auto" />
      <Header cartCount={cart.length} onCart={() => setStage("cart")} t={t} />

      <div className="grid grid-cols-3 gap-2">
        {KIND_ORDER.map((k) => {
          const Icon = KIND_ICONS[k];
          const active = kind === k;
          return (
            <button
              key={k}
              type="button"
              onClick={() => chooseKind(k)}
              className={cn(
                "flex flex-col items-center gap-1.5 rounded-2xl border-2 bg-card px-2 py-3 text-center text-sm transition-colors",
                active ? "border-primary font-semibold text-primary" : "border-transparent"
              )}
            >
              <span
                className={cn(
                  "flex h-11 w-11 items-center justify-center rounded-xl transition-colors",
                  active ? "bg-primary text-primary-foreground" : "bg-accent/40 text-primary"
                )}
              >
                <Icon className="h-5 w-5" />
              </span>
              {t.liffBook.kind[k]}
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
        <div className="space-y-4">
          {pets.length > 0 || kind === "BATH" ? (
            <div className="space-y-2">
              <p className="text-sm font-semibold">{t.liffBook.selectPet}</p>
              <div className="flex flex-wrap gap-2">
                {pets.map((p) => (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => setSelectedPetId(p.id)}
                    className={cn(
                      "flex items-center gap-1.5 rounded-full border px-4 py-2 text-sm transition-colors",
                      selectedPetId === p.id ? "border-primary bg-primary/10 font-medium text-primary" : "bg-card hover:bg-muted"
                    )}
                  >
                    <SpeciesIcon species={p.species} className="h-4 w-4" /> {p.name}
                  </button>
                ))}
              </div>
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
                onRemove={pets.length > 0 ? () => setSelectedPetId(pets[0].id) : undefined}
                invalidId={invalidId}
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
        <BottomBar>
          <Button className="h-14 w-full rounded-2xl text-base" disabled={!canNext || isPending} onClick={nextFromStart}>
            {isPending && <Loader2 className="animate-spin" />}
            {kind === "BATH" ? t.liffBook.saveAndNext : t.liff.nextStepButton}
          </Button>
        </BottomBar>
      )}
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
