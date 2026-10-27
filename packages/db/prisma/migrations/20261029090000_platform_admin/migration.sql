-- Platform admin console (WEB-31): suspending schools, and plan payments to the platform's QR with the creator's reference.

-- AlterTable
ALTER TABLE "schools" ADD COLUMN     "suspended_at" TIMESTAMP(3),
ADD COLUMN     "suspension_reason" TEXT;

-- A suspension always says why.
ALTER TABLE "schools" ADD CONSTRAINT "schools_suspension_check" CHECK (("suspended_at" IS NULL) = ("suspension_reason" IS NULL));

-- AlterTable
ALTER TABLE "plan_payments" ADD COLUMN     "reference" TEXT,
ADD COLUMN     "submitted_at" TIMESTAMP(3);
