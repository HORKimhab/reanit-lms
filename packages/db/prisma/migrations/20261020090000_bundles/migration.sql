-- Bundles (API-13): several courses sold at one price; a bundle order has one item per course.
-- AlterTable
ALTER TABLE "prices" ADD COLUMN     "bundle_id" UUID,
ALTER COLUMN "course_id" DROP NOT NULL;

-- AlterTable
ALTER TABLE "order_items" ADD COLUMN     "bundle_id" UUID;

-- CreateTable
CREATE TABLE "bundles" (
    "id" UUID NOT NULL,
    "school_id" UUID NOT NULL,
    "title" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "description" TEXT,
    "status" "CourseStatus" NOT NULL DEFAULT 'draft',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "bundles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "bundle_courses" (
    "school_id" UUID NOT NULL,
    "bundle_id" UUID NOT NULL,
    "course_id" UUID NOT NULL,
    "position" INTEGER NOT NULL,

    CONSTRAINT "bundle_courses_pkey" PRIMARY KEY ("bundle_id","course_id")
);

-- CreateIndex
CREATE INDEX "bundles_school_id_idx" ON "bundles"("school_id");

-- CreateIndex
CREATE UNIQUE INDEX "bundles_school_id_slug_key" ON "bundles"("school_id", "slug");

-- CreateIndex
CREATE INDEX "bundle_courses_school_id_idx" ON "bundle_courses"("school_id");

-- CreateIndex
CREATE INDEX "bundle_courses_course_id_idx" ON "bundle_courses"("course_id");

-- CreateIndex
CREATE INDEX "prices_bundle_id_idx" ON "prices"("bundle_id");

-- CreateIndex
CREATE INDEX "order_items_bundle_id_idx" ON "order_items"("bundle_id");

-- AddForeignKey
ALTER TABLE "prices" ADD CONSTRAINT "prices_bundle_id_fkey" FOREIGN KEY ("bundle_id") REFERENCES "bundles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bundles" ADD CONSTRAINT "bundles_school_id_fkey" FOREIGN KEY ("school_id") REFERENCES "schools"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bundle_courses" ADD CONSTRAINT "bundle_courses_school_id_fkey" FOREIGN KEY ("school_id") REFERENCES "schools"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bundle_courses" ADD CONSTRAINT "bundle_courses_bundle_id_fkey" FOREIGN KEY ("bundle_id") REFERENCES "bundles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bundle_courses" ADD CONSTRAINT "bundle_courses_course_id_fkey" FOREIGN KEY ("course_id") REFERENCES "courses"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "order_items" ADD CONSTRAINT "order_items_bundle_id_fkey" FOREIGN KEY ("bundle_id") REFERENCES "bundles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;


-- A price is a course's or a bundle's, never both.
ALTER TABLE "prices" ADD CONSTRAINT "prices_product_check" CHECK (num_nonnulls("course_id", "bundle_id") = 1);

-- Tenant isolation, as in the init migration.
ALTER TABLE "bundles" ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "bundles"
    USING ("school_id" = current_school_id()) WITH CHECK ("school_id" = current_school_id());
ALTER TABLE "bundle_courses" ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "bundle_courses"
    USING ("school_id" = current_school_id()) WITH CHECK ("school_id" = current_school_id());
