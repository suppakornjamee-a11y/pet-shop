"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Loader2, Plus, Trash2, Save, ImagePlus, X } from "lucide-react";
import { createCustomerWithPets, updateCustomerWithPets } from "@/app/actions/customers";
import { fileToDataUrl } from "@/lib/file";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Card,
  CardAction,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useI18n } from "@/components/i18n-provider";

type PetForm = {
  id?: string;
  name: string;
  species: "DOG" | "CAT";
  gender: "MALE" | "FEMALE" | "UNKNOWN";
  breed: string;
  color: string;
  weightKg: string;
  birthDate: string;
  allergies: string;
  note: string;
  aggressiveNotes: string;
  foodNote: string;
  photoUrls: string[];
  vaccinePhotoUrls: string[];
  cctvConsent: boolean;
};

const emptyPet: PetForm = {
  name: "",
  species: "DOG",
  gender: "UNKNOWN",
  breed: "",
  color: "",
  weightKg: "",
  birthDate: "",
  allergies: "",
  note: "",
  aggressiveNotes: "",
  foodNote: "",
  photoUrls: [],
  vaccinePhotoUrls: [],
  cctvConsent: false,
};

function MultiPhotoUpload({
  label,
  values,
  onChange,
}: {
  label: string;
  values: string[];
  onChange: (dataUrls: string[]) => void;
}) {
  const { t } = useI18n();
  const [loading, setLoading] = useState(false);

  async function handleFiles(files: FileList | null) {
    if (!files || files.length === 0) return;
    setLoading(true);
    try {
      const uploaded = await Promise.all(Array.from(files).map((f) => fileToDataUrl(f)));
      onChange([...values, ...uploaded]);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : t.register.uploadFailed);
    } finally {
      setLoading(false);
    }
  }

  function removeAt(idx: number) {
    onChange(values.filter((_, i) => i !== idx));
  }

  return (
    <div className="space-y-2">
      <Label>{label}</Label>
      <div className="flex flex-wrap gap-3">
        {values.map((v, idx) => (
          <div key={idx} className="relative w-fit">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={v}
              alt={`${label} ${idx + 1}`}
              className="h-28 w-28 rounded-lg border object-cover"
            />
            <button
              type="button"
              onClick={() => removeAt(idx)}
              className="absolute -top-2 -right-2 flex h-6 w-6 items-center justify-center rounded-full border bg-background text-muted-foreground shadow-sm hover:text-destructive"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        ))}
        <label className="flex h-28 w-28 cursor-pointer flex-col items-center justify-center gap-1.5 rounded-lg border border-dashed text-xs text-muted-foreground transition-colors hover:bg-accent/50">
          {loading ? (
            <Loader2 className="h-5 w-5 animate-spin" />
          ) : (
            <>
              <ImagePlus className="h-5 w-5" />
              {t.register.uploadPhoto}
            </>
          )}
          <input
            type="file"
            accept="image/*"
            multiple
            className="hidden"
            disabled={loading}
            onChange={(e) => handleFiles(e.target.files)}
          />
        </label>
      </div>
    </div>
  );
}

type CustomerForm = {
  name: string;
  phone: string;
  email: string;
  address: string;
  lineId: string;
  note: string;
};

const emptyCustomer: CustomerForm = {
  name: "",
  phone: "",
  email: "",
  address: "",
  lineId: "",
  note: "",
};

export function RegisterForm({
  mode = "create",
  customerId,
  initialCustomer,
  initialPets,
}: {
  mode?: "create" | "edit";
  customerId?: string;
  initialCustomer?: CustomerForm;
  initialPets?: PetForm[];
}) {
  const { t } = useI18n();
  const router = useRouter();
  const isEdit = mode === "edit";
  const [isPending, startTransition] = useTransition();

  const [customer, setCustomer] = useState<CustomerForm>(initialCustomer ?? emptyCustomer);
  const [pets, setPets] = useState<PetForm[]>(
    initialPets && initialPets.length > 0 ? initialPets : [{ ...emptyPet }]
  );

  function updatePet(i: number, patch: Partial<PetForm>) {
    setPets((prev) => prev.map((p, idx) => (idx === i ? { ...p, ...patch } : p)));
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    startTransition(async () => {
      const petsPayload = pets.map((p) => ({
        ...p,
        weightKg: p.weightKg ? Number(p.weightKg) : undefined,
      }));
      const res =
        isEdit && customerId
          ? await updateCustomerWithPets({ customerId, customer, pets: petsPayload })
          : await createCustomerWithPets({ customer, pets: petsPayload });
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      toast.success(res.message ?? t.register.saveSuccess);
      router.push(`/customers/${res.id ?? customerId}`);
    });
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* ข้อมูลเจ้าของ */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">{t.register.ownerInfoTitle}</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label>{t.register.ownerNameLabel}</Label>
            <Input
              value={customer.name}
              onChange={(e) => setCustomer({ ...customer, name: e.target.value })}
              placeholder={t.register.ownerNamePlaceholder}
              required
            />
          </div>
          <div className="space-y-2">
            <Label>{t.register.phoneLabel}</Label>
            <Input
              value={customer.phone}
              onChange={(e) => setCustomer({ ...customer, phone: e.target.value })}
              placeholder={t.register.phonePlaceholder}
              required
            />
          </div>
          <div className="space-y-2">
            <Label>{t.register.emailLabel}</Label>
            <Input
              type="email"
              value={customer.email}
              onChange={(e) => setCustomer({ ...customer, email: e.target.value })}
              placeholder={t.register.emailPlaceholder}
            />
          </div>
          <div className="space-y-2">
            <Label>{t.register.lineIdLabel}</Label>
            <Input
              value={customer.lineId}
              onChange={(e) => setCustomer({ ...customer, lineId: e.target.value })}
              placeholder={t.register.lineIdPlaceholder}
            />
          </div>
          <div className="space-y-2 sm:col-span-2">
            <Label>{t.register.addressLabel}</Label>
            <Textarea
              value={customer.address}
              onChange={(e) => setCustomer({ ...customer, address: e.target.value })}
              placeholder={t.register.addressPlaceholder}
              rows={2}
            />
          </div>
        </CardContent>
      </Card>

      {/* สัตว์เลี้ยง */}
      {pets.map((pet, i) => (
        <Card key={i}>
          <CardHeader>
            <CardTitle className="text-base">
              {pet.species === "CAT" ? "🐱" : "🐶"} {t.register.petNumberTitle(i + 1)}
            </CardTitle>
            {pets.length > 1 && !pet.id && (
              <CardAction>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  onClick={() => setPets((prev) => prev.filter((_, idx) => idx !== i))}
                >
                  <Trash2 className="text-destructive" />
                </Button>
              </CardAction>
            )}
          </CardHeader>
          <CardContent className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-4 sm:col-span-2">
              <MultiPhotoUpload
                label={t.register.petPhotoLabel}
                values={pet.photoUrls}
                onChange={(v) => updatePet(i, { photoUrls: v })}
              />
              <MultiPhotoUpload
                label={t.register.vaccinePhotoLabel}
                values={pet.vaccinePhotoUrls}
                onChange={(v) => updatePet(i, { vaccinePhotoUrls: v })}
              />
            </div>
            <div className="space-y-2">
              <Label>{t.register.petNameLabel}</Label>
              <Input
                value={pet.name}
                onChange={(e) => updatePet(i, { name: e.target.value })}
                placeholder={t.register.petNamePlaceholder}
                required
              />
            </div>
            <div className="space-y-2">
              <Label>{t.register.speciesLabel}</Label>
              <Select
                value={pet.species}
                onValueChange={(v) => updatePet(i, { species: v as "DOG" | "CAT" })}
                items={{ DOG: t.customers.petDialog.dog, CAT: t.customers.petDialog.cat }}
              >
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="DOG">{t.customers.petDialog.dog}</SelectItem>
                  <SelectItem value="CAT">{t.customers.petDialog.cat}</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>{t.register.genderLabel}</Label>
              <Select
                value={pet.gender}
                onValueChange={(v) =>
                  updatePet(i, { gender: v as PetForm["gender"] })
                }
                items={{
                  MALE: t.customers.petDialog.male,
                  FEMALE: t.customers.petDialog.female,
                  UNKNOWN: t.customers.petDialog.unknown,
                }}
              >
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="MALE">{t.customers.petDialog.male}</SelectItem>
                  <SelectItem value="FEMALE">{t.customers.petDialog.female}</SelectItem>
                  <SelectItem value="UNKNOWN">{t.customers.petDialog.unknown}</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>{t.register.breedLabel}</Label>
              <Input
                value={pet.breed}
                onChange={(e) => updatePet(i, { breed: e.target.value })}
                placeholder={t.register.breedPlaceholder}
              />
            </div>
            <div className="space-y-2">
              <Label>{t.register.colorLabel}</Label>
              <Input
                value={pet.color}
                onChange={(e) => updatePet(i, { color: e.target.value })}
                placeholder={t.register.colorPlaceholder}
              />
            </div>
            <div className="space-y-2">
              <Label>{t.register.weightLabel}</Label>
              <Input
                type="number"
                step="0.1"
                value={pet.weightKg}
                onChange={(e) => updatePet(i, { weightKg: e.target.value })}
                placeholder={t.register.weightPlaceholder}
              />
            </div>
            <div className="space-y-2">
              <Label>{t.register.birthDateLabel}</Label>
              <Input
                type="date"
                value={pet.birthDate}
                onChange={(e) => updatePet(i, { birthDate: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label>{t.register.foodNoteLabel}</Label>
              <Input
                value={pet.foodNote}
                onChange={(e) => updatePet(i, { foodNote: e.target.value })}
                placeholder={t.register.foodNotePlaceholder}
              />
            </div>
            <div className="space-y-2 sm:col-span-2">
              <Label className="text-destructive">{t.register.aggressiveNotesLabel}</Label>
              <Textarea
                value={pet.aggressiveNotes}
                onChange={(e) => updatePet(i, { aggressiveNotes: e.target.value })}
                placeholder={t.register.aggressiveNotesPlaceholder}
                rows={2}
              />
            </div>
            <div className="space-y-2 sm:col-span-2">
              <Label>{t.register.allergiesLabel}</Label>
              <Textarea
                value={pet.allergies}
                onChange={(e) => updatePet(i, { allergies: e.target.value })}
                placeholder={t.register.allergiesPlaceholder}
                rows={2}
              />
            </div>
            <div className="space-y-2 sm:col-span-2">
              <Label>{t.register.noteLabel}</Label>
              <Textarea
                value={pet.note}
                onChange={(e) => updatePet(i, { note: e.target.value })}
                placeholder={t.register.notePlaceholder}
                rows={2}
              />
            </div>
            <label className="flex items-center gap-2 text-sm sm:col-span-2">
              <input
                type="checkbox"
                checked={pet.cctvConsent}
                onChange={(e) => updatePet(i, { cctvConsent: e.target.checked })}
                className="h-4 w-4 accent-primary"
              />
              {t.register.cctvConsent}
            </label>
          </CardContent>
        </Card>
      ))}

      <div className="flex flex-col gap-3 sm:flex-row sm:justify-between">
        <Button
          type="button"
          variant="outline"
          onClick={() => setPets((prev) => [...prev, { ...emptyPet }])}
        >
          <Plus /> {t.register.addAnotherPet}
        </Button>
        <Button type="submit" disabled={isPending}>
          {isPending ? <Loader2 className="animate-spin" /> : <Save />}
          {t.register.saveData}
        </Button>
      </div>
    </form>
  );
}
