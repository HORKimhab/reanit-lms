-- Drip content (API-15): a lesson opens some days after enrollment, or on a date.
-- AlterTable
ALTER TABLE "lessons" ADD COLUMN     "unlock_after_days" INTEGER,
ADD COLUMN     "unlock_at" TIMESTAMP(3);


ALTER TABLE "lessons" ADD CONSTRAINT "lessons_unlock_check" CHECK (
    ("unlock_after_days" IS NULL OR "unlock_at" IS NULL) AND ("unlock_after_days" IS NULL OR "unlock_after_days" BETWEEN 1 AND 3650)
);
