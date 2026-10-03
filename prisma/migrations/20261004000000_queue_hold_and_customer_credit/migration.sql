-- กันคิวชั่วคราวระหว่างรอพนักงานอนุมัติคิวมีกำหนดหมดอายุแล้ว (เดิมกันไว้ไม่มีกำหนด) + ธงลูกค้าเลือก "คืนเงิน" ตอนยกเลิก
-- + ระบบเครดิตลูกค้า (ยอดรวมอยู่ที่ Customer.creditBalance ประวัติการได้/ใช้เครดิตอยู่ที่ CustomerCredit)
-- AlterTable
ALTER TABLE "Order" ADD COLUMN     "queueHoldExpiresAt" TIMESTAMP(3),
ADD COLUMN     "refundPending" BOOLEAN NOT NULL DEFAULT false;
-- AlterTable
ALTER TABLE "Customer" ADD COLUMN     "creditBalance" INTEGER NOT NULL DEFAULT 0;
-- CreateTable
CREATE TABLE "CustomerCredit" (
    "id" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "amount" INTEGER NOT NULL,
    "reason" TEXT NOT NULL,
    "orderId" TEXT,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "CustomerCredit_pkey" PRIMARY KEY ("id")
);
-- CreateIndex
CREATE INDEX "Order_queueHoldExpiresAt_idx" ON "Order"("queueHoldExpiresAt");
-- CreateIndex
CREATE INDEX "CustomerCredit_customerId_idx" ON "CustomerCredit"("customerId");
-- CreateIndex
CREATE INDEX "CustomerCredit_orderId_idx" ON "CustomerCredit"("orderId");
-- AddForeignKey
ALTER TABLE "CustomerCredit" ADD CONSTRAINT "CustomerCredit_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE CASCADE ON UPDATE CASCADE;
-- AddForeignKey
ALTER TABLE "CustomerCredit" ADD CONSTRAINT "CustomerCredit_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE SET NULL ON UPDATE CASCADE;
-- AddForeignKey
ALTER TABLE "CustomerCredit" ADD CONSTRAINT "CustomerCredit_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
