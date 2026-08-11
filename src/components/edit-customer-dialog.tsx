"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Loader2, Pencil, Save } from "lucide-react";
import { updateCustomer } from "@/app/actions/customers";
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

type Customer = {
  id: string;
  name: string;
  phone: string;
  email: string | null;
  address: string | null;
  lineId: string | null;
  note: string | null;
};

export function EditCustomerDialog({ customer }: { customer: Customer }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [form, setForm] = useState({
    name: customer.name,
    phone: customer.phone,
    email: customer.email ?? "",
    address: customer.address ?? "",
    lineId: customer.lineId ?? "",
    note: customer.note ?? "",
  });

  function submit() {
    startTransition(async () => {
      const res = await updateCustomer({ id: customer.id, data: form });
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      toast.success(res.message);
      setOpen(false);
      router.refresh();
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button variant="outline" />}>
        <Pencil /> แก้ไขข้อมูล
      </DialogTrigger>
      <DialogContent className="max-h-[90dvh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>แก้ไขข้อมูลเจ้าของ</DialogTitle>
        </DialogHeader>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label>ชื่อเจ้าของ *</Label>
            <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          </div>
          <div className="space-y-2">
            <Label>เบอร์โทร *</Label>
            <Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
          </div>
          <div className="space-y-2">
            <Label>อีเมล</Label>
            <Input
              type="email"
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
            />
          </div>
          <div className="space-y-2">
            <Label>LINE ID</Label>
            <Input value={form.lineId} onChange={(e) => setForm({ ...form, lineId: e.target.value })} />
          </div>
          <div className="space-y-2 sm:col-span-2">
            <Label>ที่อยู่ติดต่อ</Label>
            <Textarea
              value={form.address}
              onChange={(e) => setForm({ ...form, address: e.target.value })}
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
          <Button onClick={submit} disabled={isPending || !form.name || !form.phone}>
            {isPending ? <Loader2 className="animate-spin" /> : <Save />}
            บันทึก
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
