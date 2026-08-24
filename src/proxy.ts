import NextAuth from "next-auth";
import { authConfig } from "@/auth.config";

// Server Component เรียก auth()/requireAdmin() ได้ แต่ set cookie ไม่ได้ (ข้อจำกัดของ Next.js)
// จึงต้องให้ proxy เรียก auth() ในทุก request เพื่อให้กลไก sliding session (updateAge: 0 ใน src/auth.config.ts) ต่ออายุคุกกี้ได้จริง
// ใช้ authConfig (ไม่มี Credentials provider ที่พึ่ง Prisma) แยกจาก src/auth.ts เพื่อไม่ต้องพ่วง Prisma เข้ามาที่นี่โดยไม่จำเป็น
export const proxy = NextAuth(authConfig).auth;

export const config = {
  matcher: ["/((?!api/auth|_next/static|_next/image|favicon.ico).*)"],
};
