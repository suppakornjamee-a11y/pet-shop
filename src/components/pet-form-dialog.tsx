"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Loader2, Save } from "lucide-react";
import { addPet } from "@/app/actions/customers";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useI18n } from "@/components/i18n-provider";

const emptyForm = {
  name: "",
  species: "DOG" as "DOG" | "CAT",
  gender: "UNKNOWN" as "MALE" | "FEMALE" | "UNKNOWN",
  breed: "",
  color: "",
  weightKg: "",
  allergies: "",
  note: "",
};

export function PetFormDialog({
  customerId,
  trigger,
}: {
  customerId: string;
  trigger: React.ReactElement;
}) {
  const { t } = useI18n();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [form, setForm] = useState(emptyForm);

  function submit() {
    startTransition(async () => {
      const petPayload = {
        ...form,
        weightKg: form.weightKg ? Number(form.weightKg) : undefined,
      };
      const res = await addPet({ customerId, pet: petPayload });
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      toast.success(res.message);
      setOpen(false);
      setForm(emptyForm);
      router.refresh();
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={trigger} />
      <DialogContent className="max-h-[90dvh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{t.customers.petDialog.addTitle}</DialogTitle>
        </DialogHeader>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label>{t.customers.petDialog.nameLabel}</Label>
            <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          </div>
          <div className="space-y-2">
            <Label>{t.customers.petDialog.speciesLabel}</Label>
            <Select
              value={form.species}
              onValueChange={(v) => setForm({ ...form, species: v as "DOG" | "CAT" })}
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
            <Label>{t.customers.petDialog.genderLabel}</Label>
            <Select
              value={form.gender}
              onValueChange={(v) =>
                setForm({ ...form, gender: v as "MALE" | "FEMALE" | "UNKNOWN" })
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
            <Label>{t.customers.petDialog.breedLabel}</Label>
            <Input value={form.breed} onChange={(e) => setForm({ ...form, breed: e.target.value })} />
          </div>
          <div className="space-y-2">
            <Label>{t.customers.petDialog.colorLabel}</Label>
            <Input value={form.color} onChange={(e) => setForm({ ...form, color: e.target.value })} />
          </div>
          <div className="space-y-2">
            <Label>{t.customers.petDialog.weightLabel}</Label>
            <Input
              type="number"
              step="0.1"
              value={form.weightKg}
              onChange={(e) => setForm({ ...form, weightKg: e.target.value })}
            />
          </div>
          <div className="space-y-2 sm:col-span-2">
            <Label>{t.customers.petDialog.allergiesLabel}</Label>
            <Textarea
              value={form.allergies}
              onChange={(e) => setForm({ ...form, allergies: e.target.value })}
              rows={2}
            />
          </div>
          <div className="space-y-2 sm:col-span-2">
            <Label>{t.customers.petDialog.noteLabel}</Label>
            <Textarea
              value={form.note}
              onChange={(e) => setForm({ ...form, note: e.target.value })}
              rows={2}
            />
          </div>
        </div>
        <DialogFooter>
          <Button onClick={submit} disabled={isPending || !form.name}>
            {isPending ? <Loader2 className="animate-spin" /> : <Save />}
            {t.common.save}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
