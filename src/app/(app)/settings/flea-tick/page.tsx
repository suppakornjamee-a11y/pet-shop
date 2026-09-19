import { prisma } from "@/lib/prisma";
import { requireStaffUser } from "@/lib/auth-helpers";
import { PageHeader } from "@/components/page-header";
import { FleaTickManager } from "@/components/settings/flea-tick-manager";
import { getDictionary } from "@/i18n/get-dictionary";
import { getLocale } from "@/i18n/get-locale";

export default async function FleaTickSettingsPage() {
  const user = await requireStaffUser();
  const t = getDictionary(await getLocale());

  const [products, pets] = await Promise.all([
    prisma.fleaTickProduct.findMany({
      orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
      include: { verifiedBy: { select: { name: true } } },
    }),
    // รอตรวจสอบ = ลูกค้าแจ้งเอง แล้วยังจับคู่กับฐานข้อมูลยาไม่ได้ หรือแนบหลักฐานมาให้ตรวจ
    prisma.pet.findMany({
      where: {
        fleaTickSource: "CUSTOMER",
        OR: [
          { fleaTickProductId: null, fleaTickMedicine: { not: null } },
          { NOT: { fleaTickEvidenceUrls: { isEmpty: true } } },
        ],
      },
      orderBy: { updatedAt: "desc" },
      take: 100,
      select: {
        id: true,
        name: true,
        species: true,
        fleaTickMedicine: true,
        lastFleaTickAt: true,
        fleaTickProductId: true,
        fleaTickEvidenceUrls: true,
        customer: { select: { name: true } },
      },
    }),
  ]);

  return (
    <div className="mx-auto max-w-4xl">
      <PageHeader title={t.fleaTick.title} />
      <FleaTickManager
        isAdmin={user.role === "ADMIN"}
        products={products.map((p) => ({
          id: p.id,
          name: p.name,
          formula: p.formula,
          aliases: p.aliases,
          species: p.species,
          form: p.form,
          tickValue: p.tickValue,
          tickUnit: p.tickUnit,
          fleaValue: p.fleaValue,
          fleaUnit: p.fleaUnit,
          bathNote: p.bathNote,
          labelSource: p.labelSource,
          note: p.note,
          status: p.status,
          verifiedByName: p.verifiedBy?.name ?? null,
          verifiedAt: p.verifiedAt?.toISOString() ?? null,
          active: p.active,
        }))}
        review={pets.map((p) => ({
          id: p.id,
          name: p.name,
          species: p.species,
          ownerName: p.customer.name,
          typed: p.fleaTickMedicine,
          givenAt: p.lastFleaTickAt?.toISOString() ?? null,
          productId: p.fleaTickProductId,
          evidenceUrls: p.fleaTickEvidenceUrls,
        }))}
      />
    </div>
  );
}
