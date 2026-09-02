-- CreateEnum
CREATE TYPE "CreationChannel" AS ENUM ('STAFF', 'LIFF');

-- AlterTable
ALTER TABLE "Customer" ADD COLUMN     "createdVia" "CreationChannel" NOT NULL DEFAULT 'STAFF';

-- AlterTable
ALTER TABLE "Order" ADD COLUMN     "createdVia" "CreationChannel" NOT NULL DEFAULT 'STAFF';
