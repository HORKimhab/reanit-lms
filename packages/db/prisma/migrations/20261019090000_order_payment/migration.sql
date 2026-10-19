-- CreateEnum
CREATE TYPE "PaymentMethod" AS ENUM ('stripe', 'aba_payway', 'bakong_khqr');

-- AlterTable
ALTER TABLE "orders" ADD COLUMN     "paid_at" TIMESTAMP(3),
ADD COLUMN     "payment_method" "PaymentMethod" NOT NULL,
ADD COLUMN     "provider_ref" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "orders_provider_ref_key" ON "orders"("provider_ref");

