import { redirect } from "next/navigation";
import { auth } from "@/auth";

export async function getSessionUser() {
  const session = await auth();
  return session?.user ?? null;
}

/** ต้องล็อกอิน — ไม่งั้นเด้งไป /login */
export async function requireUser() {
  const user = await getSessionUser();
  if (!user) redirect("/login");
  return user;
}

/** ต้องเป็น ADMIN เท่านั้น (สิทธิ์เต็ม) */
export async function requireAdmin() {
  const user = await requireUser();
  if (user.role !== "ADMIN") redirect("/");
  return user;
}
