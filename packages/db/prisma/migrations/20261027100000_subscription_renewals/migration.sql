-- Subscription renewals (WRK-06): which period's notices were sent, and an index for the worker's sweep.

-- AlterTable
ALTER TABLE "subscriptions" ADD COLUMN     "last_day_notice_for" TIMESTAMP(3),
ADD COLUMN     "renewal_notice_for" TIMESTAMP(3);

-- CreateIndex
CREATE INDEX "subscriptions_status_current_period_end_idx" ON "subscriptions"("status", "current_period_end");

