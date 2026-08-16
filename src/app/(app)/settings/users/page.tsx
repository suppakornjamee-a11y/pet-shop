import { requireAdmin } from "@/lib/auth-helpers";
import { prisma } from "@/lib/prisma";
import { PageHeader } from "@/components/page-header";
import { UserManager } from "@/components/settings/user-manager";
import { getDictionary } from "@/i18n/get-dictionary";
import { getLocale } from "@/i18n/get-locale";

export default async function UsersSettingsPage() {
  const me = await requireAdmin();
  const users = await prisma.user.findMany({ orderBy: { createdAt: "asc" } });
  const t = getDictionary(await getLocale());

  return (
    <div className="mx-auto max-w-4xl">
      <PageHeader
        title={t.settings.users.title}
        description={t.settings.users.description}
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
