-- Creator plans (API-26): each school's plan, the platform's fee on each sale, and creators' plan payments.

-- CreateEnum
CREATE TYPE "CreatorPlan" AS ENUM ('free', 'pro', 'business');

-- CreateEnum
CREATE TYPE "PlanPaymentStatus" AS ENUM ('pending', 'paid', 'failed');

-- AlterTable
ALTER TABLE "schools" ADD COLUMN     "plan" "CreatorPlan" NOT NULL DEFAULT 'free',
ADD COLUMN     "plan_interval" "BillingInterval",
ADD COLUMN     "plan_period_end" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "orders" ADD COLUMN     "platform_fee" INTEGER NOT NULL DEFAULT 0;

-- CreateTable
CREATE TABLE "plan_payments" (
    "id" UUID NOT NULL,
    "school_id" UUID NOT NULL,
    "plan" "CreatorPlan" NOT NULL,
    "interval" "BillingInterval" NOT NULL,
    "amount" INTEGER NOT NULL,
    "currency" CHAR(3) NOT NULL DEFAULT 'USD',
    "method" "PaymentMethod" NOT NULL,
    "status" "PlanPaymentStatus" NOT NULL DEFAULT 'pending',
    "provider_ref" TEXT,
    "paid_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "plan_payments_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "plan_payments_provider_ref_key" ON "plan_payments"("provider_ref");

-- CreateIndex
CREATE INDEX "plan_payments_school_id_idx" ON "plan_payments"("school_id");

-- AddForeignKey
ALTER TABLE "plan_payments" ADD CONSTRAINT "plan_payments_school_id_fkey" FOREIGN KEY ("school_id") REFERENCES "schools"("id") ON DELETE CASCADE ON UPDATE CASCADE;


-- A paid plan has a period and its end; Free has neither.
ALTER TABLE "schools" ADD CONSTRAINT "schools_plan_period_check" CHECK (
    ("plan" = 'free' AND "plan_interval" IS NULL AND "plan_period_end" IS NULL)
    OR ("plan" <> 'free' AND "plan_interval" IS NOT NULL AND "plan_period_end" IS NOT NULL)
);

-- Tenant isolation, as in the init migration.
ALTER TABLE "plan_payments" ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "plan_payments"
    USING ("school_id" = current_school_id()) WITH CHECK ("school_id" = current_school_id());
