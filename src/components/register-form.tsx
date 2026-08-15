"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Loader2, Plus, Trash2, Save } from "lucide-react";
import { createCustomerWithPets } from "@/app/actions/customers";
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

type PetForm = {
  name: string;
  species: "DOG" | "CAT";
  gender: "MALE" | "FEMALE" | "UNKNOWN";
  breed: string;
  color: string;
  weightKg: string;
  allergies: string;
  note: string;
};

const emptyPet: PetForm = {
  name: "",
  species: "DOG",
  gender: "UNKNOWN",
  breed: "",
  color: "",
  weightKg: "",
  allergies: "",
  note: "",
};

export function RegisterForm() {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const [customer, setCustomer] = useState({
    name: "",
    phone: "",
    email: "",
    address: "",
    lineId: "",
    note: "",
  });
  const [pets, setPets] = useState<PetForm[]>([{ ...emptyPet }]);

  function updatePet(i: number, patch: Partial<PetForm>) {
    setPets((prev) => prev.map((p, idx) => (idx === i ? { ...p, ...patch } : p)));
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    startTransition(async () => {
      const res = await createCustomerWithPets({
        customer,
        pets: pets.map((p) => ({
          ...p,
          weightKg: p.weightKg ? Number(p.weightKg) : undefined,
        })),
      });
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      toast.success(res.message ?? "บันทึกเรียบร้อย");
      router.push(`/customers/${res.id}`);
    });
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* ข้อมูลเจ้าของ */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">ข้อมูลเจ้าของ</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label>ชื่อเจ้าของ *</Label>
            <Input
              value={customer.name}
              onChange={(e) => setCustomer({ ...customer, name: e.target.value })}
              placeholder="เช่น คุณสมชาย ใจดี"
              required
            />
          </div>
          <div className="space-y-2">
            <Label>เบอร์โทรติดต่อ *</Label>
            <Input
              value={customer.phone}
              onChange={(e) => setCustomer({ ...customer, phone: e.target.value })}
              placeholder="08x-xxx-xxxx"
              required
            />
          </div>
          <div className="space-y-2">
            <Label>อีเมล</Label>
            <Input
              type="email"
              value={customer.email}
              onChange={(e) => setCustomer({ ...customer, email: e.target.value })}
              placeholder="อีเมล (ถ้ามี)"
            />
          </div>
          <div className="space-y-2">
            <Label>LINE ID</Label>
            <Input
              value={customer.lineId}
              onChange={(e) => setCustomer({ ...customer, lineId: e.target.value })}
              placeholder="LINE ID (ถ้ามี)"
            />
          </div>
          <div className="space-y-2 sm:col-span-2">
            <Label>ที่อยู่ติดต่อ</Label>
            <Textarea
              value={customer.address}
              onChange={(e) => setCustomer({ ...customer, address: e.target.value })}
              placeholder="ที่อยู่สำหรับติดต่อ"
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
              {pet.species === "CAT" ? "🐱" : "🐶"} สัตว์เลี้ยงตัวที่ {i + 1}
            </CardTitle>
            {pets.length > 1 && (
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
            <div className="space-y-2">
              <Label>ชื่อสัตว์เลี้ยง *</Label>
              <Input
                value={pet.name}
                onChange={(e) => updatePet(i, { name: e.target.value })}
                placeholder="เช่น เจ้าด่าง"
                required
              />
            </div>
            <div className="space-y-2">
              <Label>ชนิด *</Label>
              <Select
                value={pet.species}
                onValueChange={(v) => updatePet(i, { species: v as "DOG" | "CAT" })}
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
                value={pet.gender}
                onValueChange={(v) =>
                  updatePet(i, { gender: v as PetForm["gender"] })
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
              <Input
                value={pet.breed}
                onChange={(e) => updatePet(i, { breed: e.target.value })}
                placeholder="เช่น ปอมเมอเรเนียน"
              />
            </div>
            <div className="space-y-2">
              <Label>สี</Label>
              <Input
                value={pet.color}
                onChange={(e) => updatePet(i, { color: e.target.value })}
                placeholder="เช่น น้ำตาล-ขาว"
              />
            </div>
            <div className="space-y-2">
              <Label>น้ำหนัก (กก.)</Label>
              <Input
                type="number"
                step="0.1"
                value={pet.weightKg}
                onChange={(e) => updatePet(i, { weightKg: e.target.value })}
                placeholder="เช่น 4.5"
              />
            </div>
            <div className="space-y-2 sm:col-span-2">
              <Label>อาการแพ้ / ยาที่แพ้</Label>
              <Textarea
                value={pet.allergies}
                onChange={(e) => updatePet(i, { allergies: e.target.value })}
                placeholder="ระบุอาการแพ้หรือยาที่แพ้ (ถ้ามี) เพื่อความปลอดภัย"
                rows={2}
              />
            </div>
            <div className="space-y-2 sm:col-span-2">
              <Label>หมายเหตุ</Label>
              <Textarea
                value={pet.note}
                onChange={(e) => updatePet(i, { note: e.target.value })}
                placeholder="พฤติกรรม / ข้อควรระวังอื่นๆ"
                rows={2}
              />
            </div>
          </CardContent>
        </Card>
      ))}

      <div className="flex flex-col gap-3 sm:flex-row sm:justify-between">
        <Button
          type="button"
          variant="outline"
          onClick={() => setPets((prev) => [...prev, { ...emptyPet }])}
        >
          <Plus /> เพิ่มสัตว์เลี้ยงอีกตัว
        </Button>
        <Button type="submit" disabled={isPending}>
          {isPending ? <Loader2 className="animate-spin" /> : <Save />}
          บันทึกข้อมูล
        </Button>
      </div>
    </form>
  );
}
