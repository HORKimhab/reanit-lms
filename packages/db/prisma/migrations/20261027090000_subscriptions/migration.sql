-- Subscriptions and payment plans (API-25): price kinds, one order per period, and offline QR payments staff confirm.

-- CreateEnum
CREATE TYPE "PriceKind" AS ENUM ('one_time', 'recurring', 'payment_plan');

-- CreateEnum
CREATE TYPE "BillingInterval" AS ENUM ('month', 'year');

-- CreateEnum
CREATE TYPE "SubscriptionStatus" AS ENUM ('pending', 'active', 'completed', 'lapsed');

-- AlterEnum
ALTER TYPE "OrderStatus" ADD VALUE 'awaiting_confirmation';

-- AlterEnum
ALTER TYPE "PaymentMethod" ADD VALUE 'offline_qr';

-- AlterTable
ALTER TABLE "schools" ADD COLUMN     "payment_qr_key" TEXT;

-- AlterTable
ALTER TABLE "prices" ADD COLUMN     "installments" INTEGER,
ADD COLUMN     "interval" "BillingInterval",
ADD COLUMN     "kind" "PriceKind" NOT NULL DEFAULT 'one_time';

-- AlterTable
ALTER TABLE "orders" ADD COLUMN     "payment_reference" TEXT,
ADD COLUMN     "subscription_id" UUID;

-- CreateTable
CREATE TABLE "subscriptions" (
    "id" UUID NOT NULL,
    "school_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "price_id" UUID NOT NULL,
    "status" "SubscriptionStatus" NOT NULL DEFAULT 'pending',
    "paid_periods" INTEGER NOT NULL DEFAULT 0,
    "current_period_end" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "subscriptions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "subscriptions_school_id_idx" ON "subscriptions"("school_id");

-- CreateIndex
CREATE INDEX "subscriptions_user_id_idx" ON "subscriptions"("user_id");

-- CreateIndex
CREATE INDEX "orders_subscription_id_idx" ON "orders"("subscription_id");

-- AddForeignKey
ALTER TABLE "orders" ADD CONSTRAINT "orders_subscription_id_fkey" FOREIGN KEY ("subscription_id") REFERENCES "subscriptions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "subscriptions" ADD CONSTRAINT "subscriptions_school_id_fkey" FOREIGN KEY ("school_id") REFERENCES "schools"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "subscriptions" ADD CONSTRAINT "subscriptions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "subscriptions" ADD CONSTRAINT "subscriptions_price_id_fkey" FOREIGN KEY ("price_id") REFERENCES "prices"("id") ON DELETE RESTRICT ON UPDATE CASCADE;


-- A recurring price has a period and a payment plan a number of instalments; a one-time price has neither.
ALTER TABLE "prices" ADD CONSTRAINT "prices_kind_terms_check" CHECK (
    ("kind" = 'one_time' AND "interval" IS NULL AND "installments" IS NULL)
    OR ("kind" = 'recurring' AND "interval" IS NOT NULL AND "installments" IS NULL)
    OR ("kind" = 'payment_plan' AND "interval" IS NULL AND "installments" >= 2)
);

-- Tenant isolation, as in the init migration.
ALTER TABLE "subscriptions" ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "subscriptions"
    USING ("school_id" = current_school_id()) WITH CHECK ("school_id" = current_school_id());
