import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

/**
 * คืนค่า user จาก session — เช็คกับฐานข้อมูลจริงด้วยว่ายังมีอยู่/ยัง active อยู่หรือไม่
 * (session เป็น JWT ไม่ผูกกับ DB โดยตรง ถ้า user ถูกลบ/ปิดใช้งานไปแล้ว ต้องไม่ถือว่า login อยู่)
 */
export async function getSessionUser() {
  const session = await auth();
  if (!session?.user?.id) return null;
  const exists = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { id: true, active: true },
  });
  if (!exists || !exists.active) return null;
  return session.user;
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
