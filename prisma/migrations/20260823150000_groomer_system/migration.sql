-- AlterEnum
ALTER TYPE "Role" ADD VALUE 'GROOMER';

-- CreateEnum
CREATE TYPE "GroomerLevel" AS ENUM ('JUNIOR', 'SENIOR');

-- AlterTable: User
ALTER TABLE "User" ADD COLUMN     "groomerLevel" "GroomerLevel";

-- AlterTable: Service
ALTER TABLE "Service" ADD COLUMN     "commissionPercent" DOUBLE PRECISION,
ADD COLUMN     "commissionFlat" INTEGER;

-- AlterTable: Order
ALTER TABLE "Order" ADD COLUMN     "holidaySurcharge" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "holidayLabel" TEXT;

-- CreateTable
CREATE TABLE "OrderActivityLog" (
    "id" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "OrderActivityLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "OrderActivityLog_orderId_idx" ON "OrderActivityLog"("orderId");

-- AddForeignKey
ALTER TABLE "OrderActivityLog" ADD CONSTRAINT "OrderActivityLog_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrderActivityLog" ADD CONSTRAINT "OrderActivityLog_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- CreateTable
CREATE TABLE "Holiday" (
    "id" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "title" TEXT NOT NULL,
    "extraCharge" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Holiday_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Holiday_date_key" ON "Holiday"("date");
