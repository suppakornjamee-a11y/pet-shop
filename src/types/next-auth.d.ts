import type { Role, GroomerLevel } from "@/generated/prisma/enums";
import type { DefaultSession } from "next-auth";

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      role: Role;
      username: string;
      groomerLevel: GroomerLevel | null;
    } & DefaultSession["user"];
  }

  interface User {
    role: Role;
    username: string;
    groomerLevel: GroomerLevel | null;
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    uid: string;
    role: Role;
    username: string;
    groomerLevel: GroomerLevel | null;
  }
}
