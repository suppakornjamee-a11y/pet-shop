"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Loader2, Plus, Pencil, Trash2, Landmark, QrCode, Star } from "lucide-react";
import { upsertBankAccount, deleteBankAccount } from "@/app/actions/settings";
import type { AccountType } from "@/generated/prisma/enums";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

type Account = {
  id: string;
  bankName: string;
  accountName: string;
  accountNumber: string;
  promptpayId: string | null;
  type: AccountType;
  isDefault: boolean;
  active: boolean;
};

const empty = {
  bankName: "",
  accountName: "",
  accountNumber: "",
  promptpayId: "",
  type: "BANK" as AccountType,
  isDefault: false,
};

export function BankManager({ accounts }: { accounts: Account[] }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Account | null>(null);
  const [form, setForm] = useState(empty);

  function openNew() {
    setEditing(null);
    setForm(empty);
    setOpen(true);
  }
  function openEdit(a: Account) {
    setEditing(a);
    setForm({
      bankName: a.bankName,
      accountName: a.accountName,
      accountNumber: a.accountNumber,
      promptpayId: a.promptpayId ?? "",
      type: a.type,
      isDefault: a.isDefault,
    });
    setOpen(true);
  }

  function save() {
    startTransition(async () => {
      const res = await upsertBankAccount({
        id: editing?.id,
        bankName: form.bankName,
        accountName: form.accountName,
        accountNumber: form.accountNumber,
        promptpayId: form.promptpayId || undefined,
        type: form.type,
        isDefault: form.isDefault,
        active: true,
      });
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      toast.success(res.message);
      setOpen(false);
      router.refresh();
    });
  }

  function remove(id: string) {
    if (!confirm("ลบบัญชีนี้?")) return;
    startTransition(async () => {
      const res = await deleteBankAccount(id);
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      toast.success(res.message);
      router.refresh();
    });
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Button onClick={openNew}>
          <Plus /> เพิ่มบัญชี
        </Button>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        {accounts.map((a) => (
          <Card key={a.id}>
            <CardContent className="space-y-3 py-2">
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-2">
                  {a.type === "PROMPTPAY" ? (
                    <QrCode className="h-5 w-5 text-primary" />
                  ) : (
                    <Landmark className="h-5 w-5 text-primary" />
                  )}
                  <div>
                    <div className="font-semibold">{a.bankName}</div>
                    <div className="text-xs text-muted-foreground">{a.accountName}</div>
                  </div>
                </div>
                {a.isDefault && (
                  <Badge className="gap-1 bg-amber-500 text-white hover:bg-amber-500">
                    <Star className="h-3 w-3" /> ค่าเริ่มต้น
                  </Badge>
                )}
              </div>
              <div className="font-mono text-sm">{a.accountNumber}</div>
              {a.promptpayId && (
                <div className="text-xs text-muted-foreground">PromptPay: {a.promptpayId}</div>
              )}
              <div className="flex justify-end gap-1">
                <Button size="sm" variant="ghost" onClick={() => openEdit(a)}>
                  <Pencil className="h-4 w-4" /> แก้ไข
                </Button>
                <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => remove(a.id)}>
                  <Trash2 className="h-4 w-4 text-destructive" />
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
        {accounts.length === 0 && (
          <p className="text-sm text-muted-foreground">ยังไม่มีบัญชี</p>
        )}
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editing ? "แก้ไขบัญชี" : "เพิ่มบัญชี"}</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label>ประเภท</Label>
              <Select
                value={form.type}
                onValueChange={(v) => setForm({ ...form, type: v as AccountType })}
                items={{ BANK: "บัญชีธนาคาร", PROMPTPAY: "PromptPay" }}
              >
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="BANK">บัญชีธนาคาร</SelectItem>
                  <SelectItem value="PROMPTPAY">PromptPay</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>ชื่อธนาคาร / ช่องทาง *</Label>
              <Input
                value={form.bankName}
                onChange={(e) => setForm({ ...form, bankName: e.target.value })}
                placeholder="เช่น กสิกรไทย, PromptPay"
              />
            </div>
            <div className="space-y-2">
              <Label>ชื่อบัญชี *</Label>
              <Input
                value={form.accountName}
                onChange={(e) => setForm({ ...form, accountName: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label>เลขบัญชี *</Label>
              <Input
                value={form.accountNumber}
                onChange={(e) => setForm({ ...form, accountNumber: e.target.value })}
              />
            </div>
            <div className="space-y-2 sm:col-span-2">
              <Label>PromptPay ID (เบอร์/เลขบัตร — สำหรับสร้าง QR)</Label>
              <Input
                value={form.promptpayId}
                onChange={(e) => setForm({ ...form, promptpayId: e.target.value })}
                placeholder="เช่น 0812345678"
              />
            </div>
            <label className="flex items-center gap-2 text-sm sm:col-span-2">
              <input
                type="checkbox"
                checked={form.isDefault}
                onChange={(e) => setForm({ ...form, isDefault: e.target.checked })}
                className="h-4 w-4 accent-primary"
              />
              ตั้งเป็นบัญชี PromptPay หลักสำหรับสร้าง QR
            </label>
          </div>
          <DialogFooter>
            <Button
              onClick={save}
              disabled={isPending || !form.bankName || !form.accountName || !form.accountNumber}
            >
              {isPending ? <Loader2 className="animate-spin" /> : <Plus />}
              บันทึก
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
