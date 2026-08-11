import { requireAdmin } from "@/lib/auth-helpers";
import { prisma } from "@/lib/prisma";
import { PageHeader } from "@/components/page-header";
import { UserManager } from "@/components/settings/user-manager";

export default async function UsersSettingsPage() {
  const me = await requireAdmin();
  const users = await prisma.user.findMany({ orderBy: { createdAt: "asc" } });

  return (
    <div className="mx-auto max-w-4xl">
      <PageHeader
        title="ผู้ใช้งาน"
        description="จัดการบัญชีพนักงานและสิทธิ์การเข้าถึง (แอดมิน / ผู้จัดการ)"
      />
      <UserManager
        currentUserId={me.id}
        users={users.map((u) => ({
          id: u.id,
          username: u.username,
          name: u.name,
          email: u.email,
          role: u.role,
          active: u.active,
        }))}
      />
    </div>
  );
}
