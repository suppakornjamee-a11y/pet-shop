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
          nickname: customer.nickname ?? "",
          phone: customer.phone,
          email: customer.email ?? "",
          lineId: customer.lineId ?? "",
          address: customer.address ?? "",
          petInstagram: customer.petInstagram ?? "",
          preferredLanguage: customer.preferredLanguage,
          note: customer.note ?? "",
        }}
        initialPets={customer.pets.map((p) => ({
          id: p.id,
          name: p.name,
          species: p.species,
          breed: p.breed ?? "",
          gender: p.gender,
          birthDate: p.birthDate ? toThaiDateStr(p.birthDate) : "",
          weightKg: p.weightKg != null ? String(p.weightKg) : "",
          color: p.color ?? "",
          personality: p.personality ?? "",
          aggressiveNotes: p.aggressiveNotes ?? "",
          allergies: p.allergies ?? "",
          vaccine5in1Date: p.vaccine5in1At ? toThaiDateStr(p.vaccine5in1At) : "",
          rabiesVaccineDate: p.rabiesVaccineAt ? toThaiDateStr(p.rabiesVaccineAt) : "",
          lastFleaTickDate: p.lastFleaTickAt ? toThaiDateStr(p.lastFleaTickAt) : "",
          fleaTickMedicine: p.fleaTickMedicine ?? "",
          foodNote: p.foodNote ?? "",
          medicationNote: p.medicationNote ?? "",
          neutered: p.neutered,
          note: p.note ?? "",
          photoUrls: p.photoUrls,
          vaccinePhotoUrls: p.vaccinePhotoUrls,
          cctvConsent: p.cctvConsent,
          vaccineComplete: p.vaccineComplete ?? false,
        }))}
      />
    </div>
  );
}
