-- Lesson comments (API-17): threads under lessons, one level of replies, hidden by staff.
-- CreateTable
CREATE TABLE "lesson_comments" (
    "id" UUID NOT NULL,
    "school_id" UUID NOT NULL,
    "lesson_id" UUID NOT NULL,
    "author_id" UUID,
    "parent_id" UUID,
    "body" TEXT NOT NULL,
    "is_hidden" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "lesson_comments_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "lesson_comments_school_id_parent_id_created_at_idx" ON "lesson_comments"("school_id", "parent_id", "created_at");

-- CreateIndex
CREATE INDEX "lesson_comments_lesson_id_created_at_idx" ON "lesson_comments"("lesson_id", "created_at");

-- CreateIndex
CREATE INDEX "lesson_comments_parent_id_idx" ON "lesson_comments"("parent_id");

-- AddForeignKey
ALTER TABLE "lesson_comments" ADD CONSTRAINT "lesson_comments_school_id_fkey" FOREIGN KEY ("school_id") REFERENCES "schools"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lesson_comments" ADD CONSTRAINT "lesson_comments_lesson_id_fkey" FOREIGN KEY ("lesson_id") REFERENCES "lessons"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lesson_comments" ADD CONSTRAINT "lesson_comments_author_id_fkey" FOREIGN KEY ("author_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lesson_comments" ADD CONSTRAINT "lesson_comments_parent_id_fkey" FOREIGN KEY ("parent_id") REFERENCES "lesson_comments"("id") ON DELETE CASCADE ON UPDATE CASCADE;


ALTER TABLE "lesson_comments" ADD CONSTRAINT "lesson_comments_body_check" CHECK (char_length("body") BETWEEN 1 AND 2000);

-- Tenant isolation, as in the init migration.
ALTER TABLE "lesson_comments" ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "lesson_comments"
    USING ("school_id" = current_school_id()) WITH CHECK ("school_id" = current_school_id());
