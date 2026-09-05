"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Loader2, Save, Plus, Pencil, Trash2, Star } from "lucide-react";
import { upsertBankAccount, deleteBankAccount } from "@/app/actions/settings";
import type { AccountType } from "@/generated/prisma/enums";
import { useI18n } from "@/components/i18n-provider";
import { useConfirm } from "@/components/confirm-provider";
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

// เรียงตามหลักพจนานุกรมไทย ก-ฮ (Intl.Collator("th"))
const THAI_BANKS = [
  "กรุงเทพ",
  "กรุงไทย",
  "กรุงศรีอยุธยา",
  "กสิกรไทย",
  "เกียรตินาคินภัทร",
  "ซีไอเอ็มบี ไทย",
  "ทหารไทยธนชาต (ttb)",
  "ไทยพาณิชย์",
  "เพื่อการเกษตรและสหกรณ์การเกษตร (ธ.ก.ส.)",
  "ยูโอบี",
  "แลนด์ แอนด์ เฮ้าส์",
  "ออมสิน",
  "อาคารสงเคราะห์",
  "อิสลามแห่งประเทศไทย",
  "ไอซีบีซี (ไทย)",
] satisfies readonly string[] as readonly string[];
const BANK_OTHER = "OTHER";

function BankTypeIcon({ className }: { className?: string }) {
  // eslint-disable-next-line @next/next/no-img-element
  return <img src="/images/icons/bank-type.png" alt="" className={className} />;
}
function PromptPayTypeIcon({ className }: { className?: string }) {
  // eslint-disable-next-line @next/next/no-img-element
  return <img src="/images/icons/promptpay-type.png" alt="" className={className} />;
}

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
  const { t } = useI18n();
  const confirm = useConfirm();
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

  async function remove(id: string) {
    if (!(await confirm({ title: t.settings.bankAccounts.confirmDelete, tone: "danger" }))) return;
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
          <Plus /> {t.settings.bankAccounts.addAccount}
        </Button>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        {accounts.map((a) => (
          <Card key={a.id}>
            <CardContent className="flex flex-1 flex-col space-y-3 py-2">
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-2">
                  {a.type === "PROMPTPAY" ? (
                    <PromptPayTypeIcon className="h-10 w-10 shrink-0 rounded-md" />
                  ) : (
                    <BankTypeIcon className="h-10 w-10 shrink-0 rounded-md" />
                  )}
                  <div>
                    <div className="font-semibold">{a.bankName}</div>
                    <div className="text-xs text-muted-foreground">{a.accountName}</div>
                  </div>
                </div>
                {a.isDefault && (
                  <Badge className="gap-1 bg-amber-500 text-white hover:bg-amber-500">
                    <Star className="h-3 w-3" /> {t.settings.bankAccounts.defaultBadge}
                  </Badge>
                )}
              </div>
              <div className="font-mono text-sm">{a.accountNumber}</div>
              <div className="mt-auto flex justify-end gap-1 pt-1">
                <Button size="sm" variant="ghost" onClick={() => openEdit(a)}>
                  <Pencil className="h-4 w-4" /> {t.common.edit}
                </Button>
                <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => remove(a.id)}>
                  <Trash2 className="h-4 w-4 text-destructive" />
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
        {accounts.length === 0 && (
          <p className="text-sm text-muted-foreground">{t.settings.bankAccounts.empty}</p>
        )}
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>
              {editing ? t.settings.bankAccounts.editAccount : t.settings.bankAccounts.addAccount}
            </DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 sm:grid-cols-2">
            {/* 1. ประเภท */}
            <div className="space-y-2">
              <Label>{t.settings.bankAccounts.typeLabel}</Label>
              <Select
                value={form.type}
                onValueChange={(v) => {
                  const type = (v ?? "BANK") as AccountType;
                  setForm({
                    ...form,
                    type,
                    // PromptPay ไม่ต้องเลือกธนาคาร — ใช้ชื่อ "PromptPay" คงที่แทน
                    bankName:
                      type === "PROMPTPAY"
                        ? t.settings.bankAccounts.typePromptpay
                        : form.bankName === t.settings.bankAccounts.typePromptpay
                          ? ""
                          : form.bankName,
                    // สลับประเภทแล้วล้างค่าของอีกฝั่งทิ้ง กันข้อมูลค้างจากประเภทเดิม
                    accountNumber: type === "PROMPTPAY" ? "" : form.accountNumber,
                    promptpayId: type === "BANK" ? "" : form.promptpayId,
                  });
                }}
                items={{ BANK: t.settings.bankAccounts.typeBank, PROMPTPAY: t.settings.bankAccounts.typePromptpay }}
              >
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="BANK">{t.settings.bankAccounts.typeBank}</SelectItem>
                  <SelectItem value="PROMPTPAY">{t.settings.bankAccounts.typePromptpay}</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* 2. ชื่อบัญชี */}
            <div className="space-y-2">
              <Label>{t.settings.bankAccounts.accountNameLabel} *</Label>
              <Input
                value={form.accountName}
                onChange={(e) => setForm({ ...form, accountName: e.target.value })}
              />
            </div>

            {/* 3. ชื่อธนาคาร */}
            <div className="space-y-2">
              <Label>{t.settings.bankAccounts.bankNameLabel} *</Label>
              <Select
                value={THAI_BANKS.includes(form.bankName) ? form.bankName : BANK_OTHER}
                onValueChange={(v) =>
                  setForm({
                    ...form,
                    bankName: !v || v === BANK_OTHER
                      ? THAI_BANKS.includes(form.bankName) ? "" : form.bankName
                      : v,
                  })
                }
                items={{
                  ...Object.fromEntries(THAI_BANKS.map((b) => [b, b])),
                  [BANK_OTHER]: t.settings.bankAccounts.bankNameOther,
                }}
                disabled={form.type === "PROMPTPAY"}
              >
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="max-h-64">
                  {THAI_BANKS.map((b) => (
                    <SelectItem key={b} value={b}>
                      {b}
                    </SelectItem>
                  ))}
                  <SelectItem value={BANK_OTHER}>{t.settings.bankAccounts.bankNameOther}</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* 4. ช่องพิมพ์ชื่อธนาคารเอง — โผล่เฉพาะตอนเลือก "อื่นๆ" */}
            {form.type !== "PROMPTPAY" && !THAI_BANKS.includes(form.bankName) && (
              <div className="space-y-2">
                <Label>{t.settings.bankAccounts.bankNameOther}</Label>
                <Input
                  placeholder={t.settings.bankAccounts.bankNameOtherPlaceholder}
                  value={form.bankName}
                  onChange={(e) => setForm({ ...form, bankName: e.target.value })}
                />
              </div>
            )}

            {/* เลขบัญชี — เฉพาะบัญชีธนาคาร (พร้อมเพย์ใช้หมายเลขพร้อมเพย์แทน) */}
            {form.type === "BANK" && (
              <div className="space-y-2">
                <Label>{t.settings.bankAccounts.accountNumberLabel} *</Label>
                <Input
                  value={form.accountNumber}
                  onChange={(e) => setForm({ ...form, accountNumber: e.target.value })}
                />
              </div>
            )}

            {/* 5. หมายเลขพร้อมเพย์ — โผล่เฉพาะตอนเลือกประเภท "พร้อมเพย์" */}
            {form.type === "PROMPTPAY" && (
              <div className="space-y-2 sm:col-span-2">
                <Label>{t.settings.bankAccounts.promptpayIdFullLabel}</Label>
                <Input
                  value={form.promptpayId}
                  onChange={(e) => setForm({ ...form, promptpayId: e.target.value })}
                />
              </div>
            )}

            <label className="flex items-center gap-2 text-sm sm:col-span-2">
              <input
                type="checkbox"
                checked={form.isDefault}
                onChange={(e) => setForm({ ...form, isDefault: e.target.checked })}
                className="h-4 w-4 accent-primary"
              />
              {t.settings.bankAccounts.setDefaultLabel}
            </label>
          </div>
          <DialogFooter>
            <Button
              onClick={save}
              disabled={
                isPending ||
                !form.bankName ||
                !form.accountName ||
                (form.type === "BANK" ? !form.accountNumber : !form.promptpayId)
              }
            >
              {isPending ? <Loader2 className="animate-spin" /> : <Save />}
              {t.common.save}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
