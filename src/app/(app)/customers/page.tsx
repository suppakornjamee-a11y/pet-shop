import { listCustomers } from "@/app/actions/customers";
import { PageHeader } from "@/components/page-header";
import { CustomerTable, type CustomerRow } from "@/components/customer-table";
import { getDictionary } from "@/i18n/get-dictionary";
import { getLocale } from "@/i18n/get-locale";
import { requireStaffUser } from "@/lib/auth-helpers";

export default async function CustomersPage() {
  await requireStaffUser();
  const initial = await listCustomers({});
  const t = getDictionary(await getLocale());

  return (
    <div className="mx-auto max-w-6xl">
      <PageHeader title={t.customers.title} />
      <CustomerTable initial={initial as CustomerRow[]} />
    </div>
  );
}
