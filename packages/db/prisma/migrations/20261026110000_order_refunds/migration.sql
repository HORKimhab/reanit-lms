-- Refunds (API-22): when a paid order was refunded, and whether staff paid the student back by hand.
-- AlterTable
ALTER TABLE "orders" ADD COLUMN     "is_refunded_by_hand" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "refunded_at" TIMESTAMP(3);
