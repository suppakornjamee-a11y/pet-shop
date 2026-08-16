import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { toThaiDateStr } from "@/lib/slots";
import { PageHeader } from "@/components/page-header";
import { RegisterForm } from "@/components/register-form";
import { getDictionary } from "@/i18n/get-dictionary";
import { getLocale } from "@/i18n/get-locale";

export default async function EditCustomerPage(props: PageProps<"/customers/[id]/edit">) {
  const { id } = await props.params;

  const customer = await prisma.customer.findUnique({
    where: { id },
    include: { pets: { orderBy: { createdAt: "asc" } } },
  });
  if (!customer) notFound();
  const t = getDictionary(await getLocale());

  return (
    <div className="mx-auto max-w-5xl">
      <PageHeader
        title={t.customers.editTitle(customer.name)}
        description={t.customers.editDescription}
      />
      <RegisterForm
        mode="edit"
        customerId={customer.id}
        initialCustomer={{
          name: customer.name,
          phone: customer.phone,
          email: customer.email ?? "",
          address: customer.address ?? "",
          lineId: customer.lineId ?? "",
          note: customer.note ?? "",
        }}
        initialPets={customer.pets.map((p) => ({
          id: p.id,
          name: p.name,
          species: p.species,
          gender: p.gender,
          breed: p.breed ?? "",
          color: p.color ?? "",
          weightKg: p.weightKg != null ? String(p.weightKg) : "",
          birthDate: p.birthDate ? toThaiDateStr(p.birthDate) : "",
          allergies: p.allergies ?? "",
          note: p.note ?? "",
          aggressiveNotes: p.aggressiveNotes ?? "",
          foodNote: p.foodNote ?? "",
          photoUrls: p.photoUrls,
          vaccinePhotoUrls: p.vaccinePhotoUrls,
          cctvConsent: p.cctvConsent,
        }))}
      />
    </div>
  );
}
