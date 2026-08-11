import Link from "next/link";
import { PawPrint } from "lucide-react";
import { searchCustomers } from "@/app/actions/customers";
import { PageHeader } from "@/components/page-header";
import { CustomerSearch } from "@/components/customer-search";
import { Button } from "@/components/ui/button";

export default async function CustomersPage() {
  const initial = await searchCustomers("");

  return (
    <div className="mx-auto max-w-4xl">
      <PageHeader
        title="ประวัติลูกค้า"
        description="ค้นหาลูกค้าเพื่อดูสัตว์เลี้ยงและประวัติการใช้บริการ"
        action={
          <Button render={<Link href="/register" />} nativeButton={false} variant="outline">
            <PawPrint /> ลงทะเบียนใหม่
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
