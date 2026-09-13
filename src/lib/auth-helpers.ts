import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

/**
 * คืนค่า user จาก session — เช็คกับฐานข้อมูลจริงด้วยว่ายังมีอยู่/ยัง active อยู่หรือไม่
 * (session เป็น JWT ไม่ผูกกับ DB โดยตรง ถ้า user ถูกลบ/ปิดใช้งานไปแล้ว ต้องไม่ถือว่า login อยู่)
 *
 * ตำแหน่ง/level/ชื่อ อ่านสดจากฐานข้อมูลทุกครั้ง ไม่ใช้ค่าที่ฝังใน JWT — ค่าใน JWT ถูกเขียนตอนล็อกอิน
 * ถ้าผู้จัดการเปลี่ยนตำแหน่งให้ใครทีหลัง (เช่นจากพนักงานเป็นช่าง) สิทธิ์เก่าจะติดอยู่จนกว่าคนนั้น
 * จะล็อกเอาท์ ทำให้ด่านตรวจสิทธิ์ทุกจุดตัดสินจากตำแหน่งที่ไม่ใช่ปัจจุบัน
 */
export async function getSessionUser() {
  const session = await auth();
  if (!session?.user?.id) return null;
  const current = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { active: true, role: true, groomerLevel: true, name: true },
  });
  if (!current || !current.active) return null;
  return {
    ...session.user,
    role: current.role,
    groomerLevel: current.groomerLevel,
    name: current.name,
  };
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

/** หน้าจัดการทั่วไป (ลงทะเบียน/ลูกค้า/ร้านค้า/ตั้งค่า/สร้างออเดอร์ ฯลฯ) — ช่างอาบน้ำ (GROOMER) เข้าไม่ได้ เห็นแค่ปฏิทิน/ออเดอร์ */
export async function requireStaffUser() {
  const user = await requireUser();
  if (user.role === "GROOMER") redirect("/calendar");
  return user;
}
