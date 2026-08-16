-- AlterTable
ALTER TABLE "Customer" ADD COLUMN     "lineUserId" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "Customer_lineUserId_key" ON "Customer"("lineUserId");

