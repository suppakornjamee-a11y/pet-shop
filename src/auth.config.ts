import type { NextAuthConfig } from "next-auth";
import type { Role, GroomerLevel } from "@/generated/prisma/enums";

// ส่วนของ config ที่ไม่แตะ Prisma — ใช้ได้ทั้งใน Node runtime (src/auth.ts) และ Edge Middleware (middleware.ts)
export const authConfig = {
  session: { strategy: "jwt", maxAge: 60 * 60, updateAge: 0 },
  trustHost: true,
  pages: { signIn: "/login" },
  providers: [],
  callbacks: {
    jwt({ token, user }) {
      if (user) {
        token.uid = user.id;
        token.role = (user as { role: Role }).role;
        token.username = (user as { username: string }).username;
        token.groomerLevel = (user as { groomerLevel: GroomerLevel | null }).groomerLevel;
      }
      return token;
    },
    session({ session, token }) {
      if (session.user) {
        session.user.id = token.uid as string;
        session.user.role = token.role as Role;
        session.user.username = token.username as string;
        session.user.groomerLevel = token.groomerLevel as GroomerLevel | null;
      }
      return session;
    },
  },
} satisfies NextAuthConfig;
