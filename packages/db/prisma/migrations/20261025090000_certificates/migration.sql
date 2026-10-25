-- Certificates (WRK-03): one per completed enrollment, with the PDF the worker stores.
-- CreateTable
CREATE TABLE "certificates" (
    "id" UUID NOT NULL,
    "school_id" UUID NOT NULL,
    "enrollment_id" UUID NOT NULL,
    "student_name" TEXT NOT NULL,
    "course_title" TEXT NOT NULL,
    "issued_at" TIMESTAMP(3) NOT NULL,
    "pdf_key" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "certificates_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "certificates_enrollment_id_key" ON "certificates"("enrollment_id");

-- CreateIndex
CREATE INDEX "certificates_school_id_idx" ON "certificates"("school_id");

-- AddForeignKey
ALTER TABLE "certificates" ADD CONSTRAINT "certificates_school_id_fkey" FOREIGN KEY ("school_id") REFERENCES "schools"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "certificates" ADD CONSTRAINT "certificates_enrollment_id_fkey" FOREIGN KEY ("enrollment_id") REFERENCES "enrollments"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Tenant isolation, as in the init migration.
ALTER TABLE "certificates" ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "certificates"
    USING ("school_id" = current_school_id()) WITH CHECK ("school_id" = current_school_id());
