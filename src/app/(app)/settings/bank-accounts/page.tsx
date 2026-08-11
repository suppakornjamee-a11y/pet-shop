import { requireAdmin } from "@/lib/auth-helpers";
import { prisma } from "@/lib/prisma";
import { PageHeader } from "@/components/page-header";
import { BankManager } from "@/components/settings/bank-manager";

export default async function BankAccountsSettingsPage() {
  await requireAdmin(); // เฉพาะแอดมินเท่านั้น
  const accounts = await prisma.bankAccount.findMany({ orderBy: { createdAt: "asc" } });

  return (
    <div className="mx-auto max-w-4xl">
      <PageHeader
        title="บัญชีธนาคาร / ช่องทางชำระเงิน"
        description="ตั้งค่าเลขบัญชีและ PromptPay สำหรับสร้าง QR — แก้ไขได้เฉพาะผู้จัดการ"
      />
      <BankManager
        accounts={accounts.map((a) => ({
          id: a.id,
          bankName: a.bankName,
          accountName: a.accountName,
          accountNumber: a.accountNumber,
          promptpayId: a.promptpayId,
          type: a.type,
          isDefault: a.isDefault,
          active: a.active,
        }))}
      />
    </div>
  );
}
