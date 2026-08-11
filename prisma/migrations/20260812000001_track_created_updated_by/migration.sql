-- เพิ่มคอลัมน์เก็บผู้สร้าง/ผู้แก้ไข (nullable, ไม่กระทบข้อมูลเดิม)

ALTER TABLE "Order" ADD COLUMN "updatedById" TEXT;
ALTER TABLE "Product" ADD COLUMN "createdById" TEXT;
ALTER TABLE "Product" ADD COLUMN "updatedById" TEXT;

ALTER TABLE "Order"
  ADD CONSTRAINT "Order_updatedById_fkey"
  FOREIGN KEY ("updatedById") REFERENCES "User"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "Product"
  ADD CONSTRAINT "Product_createdById_fkey"
  FOREIGN KEY ("createdById") REFERENCES "User"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "Product"
  ADD CONSTRAINT "Product_updatedById_fkey"
  FOREIGN KEY ("updatedById") REFERENCES "User"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;
