-- Quizzes (API-14): a quiz lesson type, its questions, and graded attempts.
-- AlterEnum
ALTER TYPE "LessonType" ADD VALUE 'quiz';

-- CreateTable
CREATE TABLE "quizzes" (
    "lesson_id" UUID NOT NULL,
    "school_id" UUID NOT NULL,
    "pass_percent" INTEGER NOT NULL,
    "questions" JSONB NOT NULL,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "quizzes_pkey" PRIMARY KEY ("lesson_id")
);

-- CreateTable
CREATE TABLE "quiz_attempts" (
    "id" UUID NOT NULL,
    "school_id" UUID NOT NULL,
    "enrollment_id" UUID NOT NULL,
    "lesson_id" UUID NOT NULL,
    "answers" JSONB NOT NULL,
    "score_percent" INTEGER NOT NULL,
    "is_passed" BOOLEAN NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "quiz_attempts_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "quizzes_school_id_idx" ON "quizzes"("school_id");

-- CreateIndex
CREATE INDEX "quiz_attempts_school_id_idx" ON "quiz_attempts"("school_id");

-- CreateIndex
CREATE INDEX "quiz_attempts_enrollment_id_lesson_id_created_at_idx" ON "quiz_attempts"("enrollment_id", "lesson_id", "created_at");

-- AddForeignKey
ALTER TABLE "quizzes" ADD CONSTRAINT "quizzes_school_id_fkey" FOREIGN KEY ("school_id") REFERENCES "schools"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "quizzes" ADD CONSTRAINT "quizzes_lesson_id_fkey" FOREIGN KEY ("lesson_id") REFERENCES "lessons"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "quiz_attempts" ADD CONSTRAINT "quiz_attempts_school_id_fkey" FOREIGN KEY ("school_id") REFERENCES "schools"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "quiz_attempts" ADD CONSTRAINT "quiz_attempts_enrollment_id_fkey" FOREIGN KEY ("enrollment_id") REFERENCES "enrollments"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "quiz_attempts" ADD CONSTRAINT "quiz_attempts_lesson_id_fkey" FOREIGN KEY ("lesson_id") REFERENCES "lessons"("id") ON DELETE CASCADE ON UPDATE CASCADE;


ALTER TABLE "quizzes" ADD CONSTRAINT "quizzes_pass_percent_check" CHECK ("pass_percent" BETWEEN 1 AND 100);
ALTER TABLE "quiz_attempts" ADD CONSTRAINT "quiz_attempts_score_percent_check" CHECK ("score_percent" BETWEEN 0 AND 100);

-- Tenant isolation, as in the init migration.
ALTER TABLE "quizzes" ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "quizzes"
    USING ("school_id" = current_school_id()) WITH CHECK ("school_id" = current_school_id());
ALTER TABLE "quiz_attempts" ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "quiz_attempts"
    USING ("school_id" = current_school_id()) WITH CHECK ("school_id" = current_school_id());
