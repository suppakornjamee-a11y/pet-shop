import { PrismaClient } from "@/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

const globalForPrisma = globalThis as unknown as {
  prisma?: PrismaClient;
};

function createClient() {
  // ปิด idle connection ฝั่ง client เร็วๆ เพื่อไม่ให้หยิบ connection ที่ local Prisma Postgres
  // ปิดทิ้งไปแล้วมาใช้ (กัน error "Server has closed the connection")
  const adapter = new PrismaPg({
    connectionString: process.env.DATABASE_URL,
    max: 5,
    idleTimeoutMillis: 1000,
    allowExitOnIdle: true,
  });
  return new PrismaClient({ adapter });
}

export const prisma = globalForPrisma.prisma ?? createClient();

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}
