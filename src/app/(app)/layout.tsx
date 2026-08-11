import { requireUser } from "@/lib/auth-helpers";
import { AppShell } from "@/components/app-shell";

// ทุกหน้าในโซนนี้ต้องล็อกอินและใช้ข้อมูลสด — ไม่ prerender เป็น static
export const dynamic = "force-dynamic";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await requireUser();

  return (
    <AppShell
      user={{
        name: user.name ?? user.username,
        username: user.username,
        role: user.role,
      }}
    >
      {children}
    </AppShell>
  );
}
