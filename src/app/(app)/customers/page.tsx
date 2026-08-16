import Link from "next/link";
import { PawPrint } from "lucide-react";
import { searchCustomers } from "@/app/actions/customers";
import { PageHeader } from "@/components/page-header";
import { CustomerSearch } from "@/components/customer-search";
import { Button } from "@/components/ui/button";
import { getDictionary } from "@/i18n/get-dictionary";
import { getLocale } from "@/i18n/get-locale";

export default async function CustomersPage() {
  const initial = await searchCustomers("");
  const t = getDictionary(await getLocale());

  return (
    <div className="mx-auto max-w-4xl">
      <PageHeader
        title={t.customers.title}
        description={t.customers.description}
        action={
          <Button render={<Link href="/register" />} nativeButton={false} variant="outline">
            <PawPrint /> {t.customers.registerNew}
          </Button>
        }
      />
      <CustomerSearch
        initial={initial.map((c) => ({
          id: c.id,
          name: c.name,
          phone: c.phone,
          pets: c.pets.map((p) => ({ id: p.id, name: p.name, species: p.species })),
        }))}
      />
    </div>
  );
}
