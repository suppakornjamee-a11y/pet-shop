
-- AlterTable
ALTER TABLE "Pet" ADD COLUMN     "photoUrls" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN     "vaccinePhotoUrls" TEXT[] DEFAULT ARRAY[]::TEXT[];

