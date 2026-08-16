import { requireAdmin } from "@/lib/auth-helpers";
import { prisma } from "@/lib/prisma";
import { PageHeader } from "@/components/page-header";
import { BankManager } from "@/components/settings/bank-manager";
import { getDictionary } from "@/i18n/get-dictionary";
import { getLocale } from "@/i18n/get-locale";

export default async function BankAccountsSettingsPage() {
  await requireAdmin(); // เฉพาะแอดมินเท่านั้น
  const accounts = await prisma.bankAccount.findMany({ orderBy: { createdAt: "asc" } });
  const t = getDictionary(await getLocale());

  return (
    <div className="mx-auto max-w-4xl">
      <PageHeader
        title={t.settings.bankAccounts.title}
        description={t.settings.bankAccounts.description}
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
