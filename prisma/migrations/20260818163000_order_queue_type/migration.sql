-- CreateEnum
CREATE TYPE "QueueType" AS ENUM ('BATH', 'OTHER');

-- AlterTable
ALTER TABLE "Order" ADD COLUMN     "queueType" "QueueType";
