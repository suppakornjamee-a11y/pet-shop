-- คำขอจองจาก LINE (ตะกร้า): จองหลายตัว/หลายบริการ ส่งครั้งเดียว อนุมัติและชำระมัดจำทั้งคำขอ
-- CreateEnum
CREATE TYPE "BookingRequestStatus" AS ENUM ('PENDING_APPROVAL', 'NEEDS_RESCHEDULE', 'PENDING_DEPOSIT', 'DEPOSIT_SUBMITTED', 'CONFIRMED', 'CANCELLED');
-- AlterEnum
ALTER TYPE "OrderStatus" ADD VALUE 'RESCHEDULE_REQUIRED';
-- AlterTable
ALTER TABLE "Order" ADD COLUMN     "bookingRequestId" TEXT,
ADD COLUMN     "groomingStyleImages" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN     "groomingStyleImagesAt" TIMESTAMP(3),
ADD COLUMN     "groomingStyleNote" TEXT;
-- AlterTable
ALTER TABLE "Pet" ADD COLUMN     "chronicDiseaseNote" TEXT,
ADD COLUMN     "groomingCautions" TEXT,
ADD COLUMN     "hasChronicDisease" BOOLEAN;
-- CreateTable
CREATE TABLE "BookingRequest" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "status" "BookingRequestStatus" NOT NULL DEFAULT 'PENDING_APPROVAL',
    "rescheduleReason" TEXT,
    "cancelReason" TEXT,
    "submittedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "approvedById" TEXT,
    "approvedAt" TIMESTAMP(3),
    "confirmedById" TEXT,
    "confirmedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "BookingRequest_pkey" PRIMARY KEY ("id")
);
-- CreateTable
CREATE TABLE "BookingRequestPayment" (
    "id" TEXT NOT NULL,
    "requestId" TEXT NOT NULL,
    "amount" INTEGER NOT NULL,
    "bankAccountId" TEXT,
    "qrPayload" TEXT,
    "expiresAt" TIMESTAMP(3),
    "slipUrl" TEXT,
    "submittedAt" TIMESTAMP(3),
    "status" "PaymentStatus" NOT NULL DEFAULT 'PENDING',
    "verifiedById" TEXT,
    "verifiedAt" TIMESTAMP(3),
    "rejectReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "BookingRequestPayment_pkey" PRIMARY KEY ("id")
);
-- CreateIndex
CREATE UNIQUE INDEX "BookingRequest_code_key" ON "BookingRequest"("code");
-- CreateIndex
CREATE INDEX "BookingRequest_status_idx" ON "BookingRequest"("status");
-- CreateIndex
CREATE INDEX "BookingRequest_customerId_idx" ON "BookingRequest"("customerId");
-- CreateIndex
CREATE INDEX "BookingRequestPayment_requestId_idx" ON "BookingRequestPayment"("requestId");
-- CreateIndex
CREATE INDEX "Order_bookingRequestId_idx" ON "Order"("bookingRequestId");
-- AddForeignKey
ALTER TABLE "BookingRequest" ADD CONSTRAINT "BookingRequest_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
-- AddForeignKey
ALTER TABLE "BookingRequest" ADD CONSTRAINT "BookingRequest_approvedById_fkey" FOREIGN KEY ("approvedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
-- AddForeignKey
ALTER TABLE "BookingRequest" ADD CONSTRAINT "BookingRequest_confirmedById_fkey" FOREIGN KEY ("confirmedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
-- AddForeignKey
ALTER TABLE "BookingRequestPayment" ADD CONSTRAINT "BookingRequestPayment_requestId_fkey" FOREIGN KEY ("requestId") REFERENCES "BookingRequest"("id") ON DELETE CASCADE ON UPDATE CASCADE;
-- AddForeignKey
ALTER TABLE "BookingRequestPayment" ADD CONSTRAINT "BookingRequestPayment_bankAccountId_fkey" FOREIGN KEY ("bankAccountId") REFERENCES "BankAccount"("id") ON DELETE SET NULL ON UPDATE CASCADE;
-- AddForeignKey
ALTER TABLE "BookingRequestPayment" ADD CONSTRAINT "BookingRequestPayment_verifiedById_fkey" FOREIGN KEY ("verifiedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
-- AddForeignKey
ALTER TABLE "Order" ADD CONSTRAINT "Order_bookingRequestId_fkey" FOREIGN KEY ("bookingRequestId") REFERENCES "BookingRequest"("id") ON DELETE SET NULL ON UPDATE CASCADE;
