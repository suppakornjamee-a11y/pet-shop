-- CreateEnum
CREATE TYPE "OrderType" AS ENUM ('SERVICE', 'SHOP');

-- AlterTable: บิลร้านอาหารเปิดได้โดยไม่ต้องผูกลูกค้า
ALTER TABLE "Order" ALTER COLUMN "customerId" DROP NOT NULL;

-- AlterTable: ชนิดออเดอร์ (ของเดิมทั้งหมดเป็นงานบริการ)
ALTER TABLE "Order" ADD COLUMN     "orderType" "OrderType" NOT NULL DEFAULT 'SERVICE';

-- CreateIndex
CREATE INDEX "Order_orderType_idx" ON "Order"("orderType");
