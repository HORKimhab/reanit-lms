-- Coupons (API-12): a school's discount codes, and the coupon an order used.
-- CreateEnum
CREATE TYPE "CouponKind" AS ENUM ('percent', 'fixed');

-- AlterTable
ALTER TABLE "orders" ADD COLUMN     "coupon_id" UUID;

-- CreateTable
CREATE TABLE "coupons" (
    "id" UUID NOT NULL,
    "school_id" UUID NOT NULL,
    "code" TEXT NOT NULL,
    "kind" "CouponKind" NOT NULL,
    "percent_off" INTEGER,
    "amount_off" INTEGER,
    "currency" CHAR(3),
    "expires_at" TIMESTAMP(3),
    "max_redemptions" INTEGER,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "coupons_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "coupons_school_id_idx" ON "coupons"("school_id");

-- CreateIndex
CREATE UNIQUE INDEX "coupons_school_id_code_key" ON "coupons"("school_id", "code");

-- CreateIndex
CREATE INDEX "orders_coupon_id_idx" ON "orders"("coupon_id");

-- AddForeignKey
ALTER TABLE "orders" ADD CONSTRAINT "orders_coupon_id_fkey" FOREIGN KEY ("coupon_id") REFERENCES "coupons"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "coupons" ADD CONSTRAINT "coupons_school_id_fkey" FOREIGN KEY ("school_id") REFERENCES "schools"("id") ON DELETE CASCADE ON UPDATE CASCADE;


-- Each kind sets exactly its own discount fields; an order always charges something, so at most 99% off.
ALTER TABLE "coupons" ADD CONSTRAINT "coupons_discount_check" CHECK (
    ("kind" = 'percent' AND "percent_off" BETWEEN 1 AND 99 AND "amount_off" IS NULL AND "currency" IS NULL)
    OR ("kind" = 'fixed' AND "amount_off" > 0 AND "currency" IS NOT NULL AND "percent_off" IS NULL)
);

-- Tenant isolation, as in the init migration.
ALTER TABLE "coupons" ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "coupons"
    USING ("school_id" = current_school_id()) WITH CHECK ("school_id" = current_school_id());
