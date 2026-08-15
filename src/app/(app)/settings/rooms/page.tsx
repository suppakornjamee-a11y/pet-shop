import { prisma } from "@/lib/prisma";
import { PageHeader } from "@/components/page-header";
import { RoomManager } from "@/components/settings/room-manager";
import { RoomCategoryManager } from "@/components/settings/room-category-manager";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";

export default async function RoomsSettingsPage() {
  const [categories, rooms] = await Promise.all([
    prisma.roomCategory.findMany({ orderBy: { sortOrder: "asc" } }),
    prisma.room.findMany({
      include: { category: true },
      orderBy: [{ category: { sortOrder: "asc" } }, { sortOrder: "asc" }],
    }),
  ]);

  return (
    <div className="mx-auto max-w-5xl">
      <PageHeader
        title="ห้องพัก"
        description="กำหนดหมวดหมู่ (Daycare, Nanny Room, Big Dog, Small Dog, Cat, Pawsome ฯลฯ) และห้อง/คอก/พื้นที่แต่ละยูนิต"
      />

      <Tabs defaultValue="rooms">
        <TabsList>
          <TabsTrigger value="rooms">ห้อง/พื้นที่ทั้งหมด</TabsTrigger>
          <TabsTrigger value="categories">หมวดหมู่</TabsTrigger>
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
