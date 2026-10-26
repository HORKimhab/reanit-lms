-- Custom domains (API-16): one per school, served once a TXT record proves ownership.
-- CreateEnum
CREATE TYPE "DomainTlsStatus" AS ENUM ('pending', 'active', 'failed');

-- CreateTable
CREATE TABLE "domains" (
    "id" UUID NOT NULL,
    "school_id" UUID NOT NULL,
    "hostname" TEXT NOT NULL,
    "verification_token" TEXT NOT NULL,
    "verified_at" TIMESTAMP(3),
    "certificate_id" TEXT,
    "tls_status" "DomainTlsStatus",
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "domains_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "domains_school_id_key" ON "domains"("school_id");

-- CreateIndex
CREATE INDEX "domains_hostname_idx" ON "domains"("hostname");

-- AddForeignKey
ALTER TABLE "domains" ADD CONSTRAINT "domains_school_id_fkey" FOREIGN KEY ("school_id") REFERENCES "schools"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Tenant isolation, as in the init migration.
ALTER TABLE "domains" ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "domains"
    USING ("school_id" = current_school_id()) WITH CHECK ("school_id" = current_school_id());
