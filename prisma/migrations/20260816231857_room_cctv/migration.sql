-- AlterTable
ALTER TABLE "Room" ADD COLUMN     "cctvModel" TEXT,
ADD COLUMN     "cctvSerial" TEXT,
ADD COLUMN     "hasCctv" BOOLEAN NOT NULL DEFAULT false;

