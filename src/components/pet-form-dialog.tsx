"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Loader2, Save } from "lucide-react";
import { addPet, updatePet } from "@/app/actions/customers";
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

type PetData = {
  id: string;
  name: string;
  species: "DOG" | "CAT";
  gender: "MALE" | "FEMALE" | "UNKNOWN";
  breed: string | null;
  color: string | null;
  weightKg: number | null;
  allergies: string | null;
  note: string | null;
};

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
  pet,
  trigger,
}: {
  customerId: string;
  pet?: PetData;
  trigger: React.ReactElement;
}) {
  const router = useRouter();
  const isEdit = !!pet;
  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [form, setForm] = useState(
    pet
      ? {
          name: pet.name,
          species: pet.species,
          gender: pet.gender,
          breed: pet.breed ?? "",
          color: pet.color ?? "",
          weightKg: pet.weightKg != null ? String(pet.weightKg) : "",
          allergies: pet.allergies ?? "",
          note: pet.note ?? "",
        }
      : emptyForm
  );

  function submit() {
    startTransition(async () => {
      const petPayload = {
        ...form,
        weightKg: form.weightKg ? Number(form.weightKg) : undefined,
      };
      const res = isEdit
        ? await updatePet({ id: pet!.id, customerId, pet: petPayload })
        : await addPet({ customerId, pet: petPayload });
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      toast.success(res.message);
      setOpen(false);
      if (!isEdit) setForm(emptyForm);
      router.refresh();
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={trigger} />
      <DialogContent className="max-h-[90dvh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{isEdit ? "แก้ไขสัตว์เลี้ยง" : "เพิ่มสัตว์เลี้ยง"}</DialogTitle>
        </DialogHeader>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label>ชื่อ *</Label>
            <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          </div>
          <div className="space-y-2">
            <Label>ชนิด</Label>
            <Select
              value={form.species}
              onValueChange={(v) => setForm({ ...form, species: v as "DOG" | "CAT" })}
              items={{ DOG: "🐶 สุนัข", CAT: "🐱 แมว" }}
            >
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="DOG">🐶 สุนัข</SelectItem>
                <SelectItem value="CAT">🐱 แมว</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>เพศ</Label>
            <Select
              value={form.gender}
              onValueChange={(v) =>
                setForm({ ...form, gender: v as "MALE" | "FEMALE" | "UNKNOWN" })
              }
              items={{ MALE: "เพศผู้", FEMALE: "เพศเมีย", UNKNOWN: "ไม่ระบุ" }}
            >
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="MALE">เพศผู้</SelectItem>
                <SelectItem value="FEMALE">เพศเมีย</SelectItem>
                <SelectItem value="UNKNOWN">ไม่ระบุ</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>สายพันธุ์</Label>
            <Input value={form.breed} onChange={(e) => setForm({ ...form, breed: e.target.value })} />
          </div>
          <div className="space-y-2">
            <Label>สี</Label>
            <Input value={form.color} onChange={(e) => setForm({ ...form, color: e.target.value })} />
          </div>
          <div className="space-y-2">
            <Label>น้ำหนัก (กก.)</Label>
            <Input
              type="number"
              step="0.1"
              value={form.weightKg}
              onChange={(e) => setForm({ ...form, weightKg: e.target.value })}
            />
          </div>
          <div className="space-y-2 sm:col-span-2">
            <Label>อาการแพ้ / ยาที่แพ้</Label>
            <Textarea
              value={form.allergies}
              onChange={(e) => setForm({ ...form, allergies: e.target.value })}
              rows={2}
            />
          </div>
          <div className="space-y-2 sm:col-span-2">
            <Label>หมายเหตุ</Label>
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
            บันทึก
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
