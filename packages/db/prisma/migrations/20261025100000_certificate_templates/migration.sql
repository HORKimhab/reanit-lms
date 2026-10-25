-- Certificate templates (WEB-22): who signs a school's certificates.
-- CreateTable
CREATE TABLE "certificate_templates" (
    "school_id" UUID NOT NULL,
    "signer_name" TEXT,
    "signer_title" TEXT,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "certificate_templates_pkey" PRIMARY KEY ("school_id")
);

-- AddForeignKey
ALTER TABLE "certificate_templates" ADD CONSTRAINT "certificate_templates_school_id_fkey" FOREIGN KEY ("school_id") REFERENCES "schools"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "certificate_templates" ADD CONSTRAINT "certificate_templates_signer_check"
    CHECK (char_length("signer_name") <= 80 AND char_length("signer_title") <= 80);

-- Tenant isolation, as in the init migration.
ALTER TABLE "certificate_templates" ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "certificate_templates"
    USING ("school_id" = current_school_id()) WITH CHECK ("school_id" = current_school_id());
