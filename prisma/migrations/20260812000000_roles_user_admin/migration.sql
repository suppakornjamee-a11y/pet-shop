-- แปลง enum Role จาก {ADMIN, MANAGER} เป็น {ADMIN, USER} แบบเก็บข้อมูลเดิม
-- map role เก่า MANAGER -> USER (ADMIN คงเดิม)

CREATE TYPE "Role_new" AS ENUM ('ADMIN', 'USER');

ALTER TABLE "User" ALTER COLUMN "role" DROP DEFAULT;

ALTER TABLE "User"
  ALTER COLUMN "role" TYPE "Role_new"
  USING (
    CASE "role"::text
      WHEN 'MANAGER' THEN 'USER'
      ELSE "role"::text
    END::"Role_new"
  );

DROP TYPE "Role";

ALTER TYPE "Role_new" RENAME TO "Role";

ALTER TABLE "User" ALTER COLUMN "role" SET DEFAULT 'USER';
