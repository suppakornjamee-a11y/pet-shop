import { prisma } from "@/lib/prisma";
import { PageHeader } from "@/components/page-header";
import { RoomManager } from "@/components/settings/room-manager";
import { RoomCategoryManager } from "@/components/settings/room-category-manager";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { getDictionary } from "@/i18n/get-dictionary";
import { getLocale } from "@/i18n/get-locale";
import { requireStaffUser } from "@/lib/auth-helpers";

export default async function RoomsSettingsPage() {
  await requireStaffUser();
  const [categories, rooms] = await Promise.all([
    prisma.roomCategory.findMany({ orderBy: { sortOrder: "asc" } }),
    prisma.room.findMany({
      include: { category: true },
      orderBy: [{ category: { sortOrder: "asc" } }, { sortOrder: "asc" }],
    }),
  ]);
  const t = getDictionary(await getLocale());

  return (
    <div className="mx-auto max-w-5xl">
      <PageHeader
        title={t.settings.rooms.title}
        description={t.settings.rooms.description}
      />

      <Tabs defaultValue="rooms">
        <TabsList>
          <TabsTrigger value="rooms">{t.settings.rooms.tabRooms}</TabsTrigger>
          <TabsTrigger value="categories">{t.settings.rooms.tabCategories}</TabsTrigger>
        </TabsList>

        <TabsContent value="rooms" className="mt-4">
          <RoomManager
            categories={categories.map((c) => ({
              id: c.id,
              name: c.name,
              billingUnit: c.billingUnit,
              active: c.active,
            }))}
            rooms={rooms.map((r) => ({
              id: r.id,
              categoryId: r.categoryId,
              categoryName: r.category.name,
              billingUnit: r.category.billingUnit,
              name: r.name,
              sortOrder: r.sortOrder,
              size: r.size,
              hasAir: r.hasAir,
              hasFan: r.hasFan,
              hasCctv: r.hasCctv,
              cctvModel: r.cctvModel,
              cctvSerial: r.cctvSerial,
              pricePerNight: r.pricePerNight,
              equipment: r.equipment,
              description: r.description,
              active: r.active,
            }))}
          />
        </TabsContent>

        <TabsContent value="categories" className="mt-4">
          <RoomCategoryManager
            categories={categories.map((c) => ({
              id: c.id,
              name: c.name,
              billingUnit: c.billingUnit,
              sortOrder: c.sortOrder,
              description: c.description,
              active: c.active,
            }))}
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}
