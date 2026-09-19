-- ฐานข้อมูลยาเห็บหมัดที่ร้านตรวจสอบ + สถานะการยืนยันข้อมูลยาของสัตว์เลี้ยง
-- CreateEnum
CREATE TYPE "DurationUnit" AS ENUM ('DAY', 'WEEK', 'MONTH');
-- CreateEnum
CREATE TYPE "FleaTickForm" AS ENUM ('CHEWABLE', 'SPOT_ON', 'COLLAR', 'OTHER');
-- CreateEnum
CREATE TYPE "VerifyStatus" AS ENUM ('PENDING', 'VERIFIED');
-- CreateEnum
CREATE TYPE "FleaTickSource" AS ENUM ('CUSTOMER', 'STAFF_CHECKED');
-- AlterTable
ALTER TABLE "Pet" ADD COLUMN     "fleaTickCheckedAt" TIMESTAMP(3),
ADD COLUMN     "fleaTickCheckedById" TEXT,
ADD COLUMN     "fleaTickEvidenceUrls" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN     "fleaTickProductId" TEXT,
ADD COLUMN     "fleaTickSource" "FleaTickSource" NOT NULL DEFAULT 'CUSTOMER';
-- CreateTable
CREATE TABLE "FleaTickProduct" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "formula" TEXT,
    "aliases" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "species" "Species",
    "form" "FleaTickForm" NOT NULL DEFAULT 'OTHER',
    "tickValue" INTEGER,
    "tickUnit" "DurationUnit",
    "fleaValue" INTEGER,
    "fleaUnit" "DurationUnit",
    "bathNote" TEXT,
    "labelSource" TEXT,
    "note" TEXT,
    "status" "VerifyStatus" NOT NULL DEFAULT 'PENDING',
    "verifiedById" TEXT,
    "verifiedAt" TIMESTAMP(3),
    "active" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "FleaTickProduct_pkey" PRIMARY KEY ("id")
);
-- CreateIndex
CREATE INDEX "Pet_fleaTickProductId_idx" ON "Pet"("fleaTickProductId");
-- AddForeignKey
ALTER TABLE "Pet" ADD CONSTRAINT "Pet_fleaTickProductId_fkey" FOREIGN KEY ("fleaTickProductId") REFERENCES "FleaTickProduct"("id") ON DELETE SET NULL ON UPDATE CASCADE;
-- AddForeignKey
ALTER TABLE "Pet" ADD CONSTRAINT "Pet_fleaTickCheckedById_fkey" FOREIGN KEY ("fleaTickCheckedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
-- AddForeignKey
ALTER TABLE "FleaTickProduct" ADD CONSTRAINT "FleaTickProduct_verifiedById_fkey" FOREIGN KEY ("verifiedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- รายการตั้งต้นจากตารางของร้าน — ทุกรายการเป็น PENDING (ยังไม่ตรวจกับฉลาก) จึงยังไม่ถูกนำไปคำนวณ
-- จนกว่าผู้จัดการจะตรวจสูตรและกดยืนยันในหน้าตั้งค่ายาเห็บหมัด
INSERT INTO "FleaTickProduct" ("id","name","formula","aliases","species","form","tickValue","tickUnit","fleaValue","fleaUnit","note","sortOrder","updatedAt") VALUES
('ftp_nexgard','NexGard ชนิดเม็ดเคี้ยว','NexGard',ARRAY['nexgard','เน็กซ์การ์ด','เนกซ์การ์ด','เน็กการ์ด'],'DOG','CHEWABLE',1,'MONTH',1,'MONTH','ใช้รายเดือน',10,CURRENT_TIMESTAMP),
('ftp_nexgard_spectra','NexGard Spectra ชนิดเม็ดเคี้ยว','NexGard Spectra',ARRAY['nexgard spectra','spectra','เน็กซ์การ์ด สเปคตร้า','เนกซ์การ์ดสเปกตร้า','สเปคตร้า'],'DOG','CHEWABLE',1,'MONTH',1,'MONTH','ใช้รายเดือน ไม่ควรขยายรอบอัตโนมัติตามข้อความประสิทธิภาพสูงสุด',20,CURRENT_TIMESTAMP),
('ftp_nexgard_combo','NexGard Combo ชนิดหยด','NexGard Combo',ARRAY['nexgard combo','combo','เน็กซ์การ์ด คอมโบ','เนกซ์การ์ดคอมโบ'],'CAT','SPOT_ON',1,'MONTH',1,'MONTH','ใช้รายเดือน',30,CURRENT_TIMESTAMP),
('ftp_simparica','Simparica ชนิดเม็ดเคี้ยว','Simparica',ARRAY['simparica','ซิมพาริก้า','ซิมพาริกา','ซิมพาริค่า'],'DOG','CHEWABLE',1,'MONTH',1,'MONTH','ใช้รายเดือน แม้ผู้ผลิตระบุประสิทธิภาพถึง 35 วัน',40,CURRENT_TIMESTAMP),
('ftp_revolution_plus','Revolution Plus ชนิดหยด','Revolution Plus',ARRAY['revolution plus','รีโวลูชั่น พลัส','เรฟโวลูชั่นพลัส','รีโวลูชันพลัส'],'CAT','SPOT_ON',1,'MONTH',1,'MONTH','ใช้รายเดือน ต้องแยกจาก Revolution สูตรปกติ',50,CURRENT_TIMESTAMP),
('ftp_bravecto_12w','Bravecto สูตรคุ้มครอง 12 สัปดาห์','Bravecto 12 สัปดาห์',ARRAY['bravecto','บราเวคโต้','บราเวคโต','บาเวคโต้'],NULL,'OTHER',12,'WEEK',12,'WEEK','อ้างอิง 12 สัปดาห์สำหรับปรสิตตามฉลาก บางชนิดเห็บมีระยะสั้นกว่า ต้องตรวจสูตรก่อนตั้งค่า · แยกสูตรสุนัข/แมว และรูปแบบยา',60,CURRENT_TIMESTAMP),
('ftp_frontline_plus_dog','Frontline Plus สูตรสุนัข','Frontline Plus สุนัข',ARRAY['frontline plus','frontline','ฟรอนท์ไลน์ พลัส','ฟร้อนท์ไลน์','ฟรอนไลน์'],'DOG','SPOT_ON',1,'MONTH',NULL,NULL,'ฉลากอ้างอิงระบุคุ้มครองเห็บอย่างน้อย 1 เดือน ต้องแยกจากสูตรแมว',70,CURRENT_TIMESTAMP),
('ftp_revolution','Revolution สูตรปกติ','Revolution',ARRAY['revolution','รีโวลูชั่น','เรฟโวลูชั่น','รีโวลูชัน'],NULL,'SPOT_ON',NULL,NULL,1,'MONTH','ใช้รายเดือนสำหรับข้อบ่งใช้ตามฉลาก ไม่ให้ถือว่าคุ้มครองเห็บเท่ากับสูตร Plus · แยกสูตรตามชนิดสัตว์',80,CURRENT_TIMESTAMP);
