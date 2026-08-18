-- CreateEnum
CREATE TYPE "ServiceGroup" AS ENUM ('ADDON', 'TREATMENT', 'SPA');

-- AlterTable
ALTER TABLE "Service" ADD COLUMN     "group" "ServiceGroup",
ADD COLUMN     "speciesScope" "Species",
ADD COLUMN     "defaultOn" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "sortOrder" INTEGER NOT NULL DEFAULT 0;

-- CreateIndex
CREATE INDEX "Service_category_idx" ON "Service"("category");
