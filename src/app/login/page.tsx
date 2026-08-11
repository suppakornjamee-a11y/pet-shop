import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/auth-helpers";
import { LoginForm } from "@/components/login-form";

export default async function LoginPage() {
  const user = await getSessionUser();
  if (user) redirect("/");

  return (
    <main className="flex min-h-dvh items-center justify-center bg-gradient-to-br from-sky-50 via-white to-violet-50 p-4 dark:from-sky-950 dark:via-background dark:to-violet-950">
      <div className="w-full max-w-md">
        <div className="mb-8 text-center">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-primary text-3xl shadow-lg shadow-primary/20">
            🐾
          </div>
          <h1 className="text-2xl font-bold tracking-tight">PetCare</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            ระบบจัดการร้านอาบน้ำ · ตัดขน · ฝากเลี้ยงสัตว์
          </p>
        </div>
        <LoginForm />
        <p className="mt-6 text-center text-xs text-muted-foreground">
          บัญชีทดลอง: <span className="font-medium">admin / admin</span> ·{" "}
          <span className="font-medium">user / user</span>
        </p>
      </div>
    </main>
  );
}
