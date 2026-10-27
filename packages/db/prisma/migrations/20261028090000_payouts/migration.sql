-- Payouts to creators (API-27): each school's payout details, and the transfers platform admins made.

-- CreateTable
CREATE TABLE "payout_accounts" (
    "id" UUID NOT NULL,
    "school_id" UUID NOT NULL,
    "holder_name" TEXT NOT NULL,
    "bank_name" TEXT NOT NULL,
    "account" TEXT NOT NULL,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "payout_accounts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "payouts" (
    "id" UUID NOT NULL,
    "school_id" UUID NOT NULL,
    "currency" CHAR(3) NOT NULL,
    "amount" INTEGER NOT NULL,
    "paid_at" TIMESTAMP(3) NOT NULL,
    "reference" TEXT NOT NULL,
    "recorded_by_id" UUID,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "payouts_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "payout_accounts_school_id_key" ON "payout_accounts"("school_id");

-- CreateIndex
CREATE INDEX "payouts_school_id_idx" ON "payouts"("school_id");

-- AddForeignKey
ALTER TABLE "payout_accounts" ADD CONSTRAINT "payout_accounts_school_id_fkey" FOREIGN KEY ("school_id") REFERENCES "schools"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payouts" ADD CONSTRAINT "payouts_school_id_fkey" FOREIGN KEY ("school_id") REFERENCES "schools"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payouts" ADD CONSTRAINT "payouts_recorded_by_id_fkey" FOREIGN KEY ("recorded_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;


-- A payout is never zero or less.
ALTER TABLE "payouts" ADD CONSTRAINT "payouts_amount_check" CHECK ("amount" > 0);

-- Tenant isolation, as in the init migration. Platform admins list and record payouts across schools through the unscoped client.
ALTER TABLE "payout_accounts" ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "payout_accounts"
    USING ("school_id" = current_school_id()) WITH CHECK ("school_id" = current_school_id());
ALTER TABLE "payouts" ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "payouts"
    USING ("school_id" = current_school_id()) WITH CHECK ("school_id" = current_school_id());
