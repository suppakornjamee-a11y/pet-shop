-- CreateEnum
CREATE TYPE "Locale" AS ENUM ('TH', 'EN');

-- AlterTable
ALTER TABLE "Customer" ADD COLUMN     "nickname" TEXT,
ADD COLUMN     "petInstagram" TEXT,
ADD COLUMN     "preferredLanguage" "Locale" NOT NULL DEFAULT 'TH';

-- AlterTable
ALTER TABLE "Pet" ADD COLUMN     "personality" TEXT,
ADD COLUMN     "medicationNote" TEXT,
ADD COLUMN     "neutered" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "vaccine5in1At" TIMESTAMP(3),
ADD COLUMN     "rabiesVaccineAt" TIMESTAMP(3);
