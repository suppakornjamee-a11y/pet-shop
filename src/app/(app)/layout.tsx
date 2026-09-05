import { requireUser } from "@/lib/auth-helpers";
import { prisma } from "@/lib/prisma";
import { AppShell } from "@/components/app-shell";

// ทุกหน้าในโซนนี้ต้องล็อกอินและใช้ข้อมูลสด — ไม่ prerender เป็น static
export const dynamic = "force-dynamic";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await requireUser();
  // ดึงสดจากฐานข้อมูล เพราะรูป/ชื่อที่แก้ในกล่องโปรไฟล์ยังไม่ถูกอัปเดตเข้า session token
  const me = await prisma.user.findUnique({
    where: { id: user.id },
    select: { name: true, email: true, avatarUrl: true },
  });

  return (
    <AppShell
      user={{
        name: me?.name ?? user.name ?? user.username,
        username: user.username,
        role: user.role,
        email: me?.email ?? "",
        avatarUrl: me?.avatarUrl ?? null,
      }}
    >
      {children}
    </AppShell>
  );
}
