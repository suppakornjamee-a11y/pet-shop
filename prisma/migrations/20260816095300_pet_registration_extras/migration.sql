
-- AlterTable
ALTER TABLE "Pet" ADD COLUMN     "aggressiveNotes" TEXT,
ADD COLUMN     "cctvConsent" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "foodNote" TEXT,
ADD COLUMN     "vaccinePhotoUrl" TEXT;

