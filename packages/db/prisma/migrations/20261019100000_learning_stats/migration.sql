-- AlterTable
ALTER TABLE "enrollments" ADD COLUMN     "completed_at" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "daily_sales" (
    "id" UUID NOT NULL,
    "school_id" UUID NOT NULL,
    "course_id" UUID NOT NULL,
    "day" DATE NOT NULL,
    "currency" CHAR(3) NOT NULL,
    "sales" INTEGER NOT NULL DEFAULT 0,
    "revenue" BIGINT NOT NULL DEFAULT 0,

    CONSTRAINT "daily_sales_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "daily_completions" (
    "id" UUID NOT NULL,
    "school_id" UUID NOT NULL,
    "course_id" UUID NOT NULL,
    "day" DATE NOT NULL,
    "completions" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "daily_completions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "daily_sales_course_id_idx" ON "daily_sales"("course_id");

-- CreateIndex
CREATE UNIQUE INDEX "daily_sales_school_id_course_id_day_currency_key" ON "daily_sales"("school_id", "course_id", "day", "currency");

-- CreateIndex
CREATE INDEX "daily_completions_course_id_idx" ON "daily_completions"("course_id");

-- CreateIndex
CREATE UNIQUE INDEX "daily_completions_school_id_course_id_day_key" ON "daily_completions"("school_id", "course_id", "day");

-- AddForeignKey
ALTER TABLE "daily_sales" ADD CONSTRAINT "daily_sales_school_id_fkey" FOREIGN KEY ("school_id") REFERENCES "schools"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "daily_sales" ADD CONSTRAINT "daily_sales_course_id_fkey" FOREIGN KEY ("course_id") REFERENCES "courses"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "daily_completions" ADD CONSTRAINT "daily_completions_school_id_fkey" FOREIGN KEY ("school_id") REFERENCES "schools"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "daily_completions" ADD CONSTRAINT "daily_completions_course_id_fkey" FOREIGN KEY ("course_id") REFERENCES "courses"("id") ON DELETE CASCADE ON UPDATE CASCADE;


-- Tenant isolation, as in the init migration.
ALTER TABLE "daily_sales" ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "daily_sales"
    USING ("school_id" = current_school_id()) WITH CHECK ("school_id" = current_school_id());
ALTER TABLE "daily_completions" ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "daily_completions"
    USING ("school_id" = current_school_id()) WITH CHECK ("school_id" = current_school_id());
