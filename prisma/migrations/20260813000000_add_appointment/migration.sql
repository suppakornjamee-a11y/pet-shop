-- เพิ่มวัน-เวลาคิวที่จอง (nullable, ไม่กระทบข้อมูลเดิม)
ALTER TABLE "Order" ADD COLUMN "appointmentAt" TIMESTAMP(3);
CREATE INDEX "Order_appointmentAt_idx" ON "Order"("appointmentAt");
