import { prisma } from "@/lib/prisma";
import { PageHeader } from "@/components/page-header";
import { RoomManager } from "@/components/settings/room-manager";

export default async function RoomsSettingsPage() {
  const rooms = await prisma.room.findMany({ orderBy: { name: "asc" } });
  return (
    <div className="mx-auto max-w-5xl">
      <PageHeader
        title="ห้องพัก"
        description="กำหนดห้องพักสำหรับฝากเลี้ยง ขนาด อุปกรณ์ และราคาต่อคืน"
      />
      <RoomManager
        rooms={rooms.map((r) => ({
          id: r.id,
          name: r.name,
          size: r.size,
          hasAir: r.hasAir,
          hasFan: r.hasFan,
          pricePerNight: r.pricePerNight,
          equipment: r.equipment,
          description: r.description,
          active: r.active,
        }))}
      />
    </div>
  );
}
