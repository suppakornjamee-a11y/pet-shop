-- AlterTable: Pet
ALTER TABLE "Pet" DROP COLUMN "cctvConsent";

-- CreateEnum
CREATE TYPE "NannyType" AS ENUM ('NONE', 'REGULAR', 'VIP');

-- AlterTable: Order — เพิ่มคอลัมน์ใหม่ ย้ายข้อมูลจาก nanny (boolean) แล้วค่อยลบคอลัมน์เก่า
ALTER TABLE "Order" ADD COLUMN     "nannyType" "NannyType" NOT NULL DEFAULT 'NONE';
UPDATE "Order" SET "nannyType" = 'REGULAR' WHERE "nanny" = true;
ALTER TABLE "Order" DROP COLUMN "nanny";
ALTER TABLE "Order" ADD COLUMN     "cctvRequested" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE "OrderExtraCharge" (
    "id" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "amount" INTEGER NOT NULL,
    "description" TEXT NOT NULL,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "OrderExtraCharge_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "OrderExtraCharge_orderId_idx" ON "OrderExtraCharge"("orderId");

-- AddForeignKey
ALTER TABLE "OrderExtraCharge" ADD CONSTRAINT "OrderExtraCharge_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrderExtraCharge" ADD CONSTRAINT "OrderExtraCharge_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
