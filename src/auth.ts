import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import type { Role, GroomerLevel } from "@/generated/prisma/enums";

export const { handlers, auth, signIn, signOut } = NextAuth({
  // ออกจากระบบอัตโนมัติถ้าไม่มี action ภายใน 1 ชั่วโมง — updateAge: 0 ทำให้ session ต่ออายุทุกครั้งที่มี request (sliding window)
  session: { strategy: "jwt", maxAge: 60 * 60, updateAge: 0 },
  trustHost: true,
  pages: { signIn: "/login" },
  providers: [
    Credentials({
      name: "credentials",
      credentials: {
        username: { label: "Username", type: "text" },
        password: { label: "Password", type: "password" },
      },
      authorize: async (credentials) => {
        const username = String(credentials?.username ?? "").trim();
        const password = String(credentials?.password ?? "");
        if (!username || !password) return null;

        const user = await prisma.user.findUnique({ where: { username } });
        if (!user || !user.active) return null;

        const valid = await bcrypt.compare(password, user.passwordHash);
        if (!valid) return null;

        return {
          id: user.id,
          name: user.name,
          email: user.email,
          role: user.role,
          username: user.username,
          groomerLevel: user.groomerLevel,
        };
      },
    }),
  ],
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
});
