-- CreateTable
CREATE TABLE "audit_events" (
    "id" UUID NOT NULL,
    "school_id" UUID NOT NULL,
    "actor_id" UUID,
    "action" TEXT NOT NULL,
    "target_id" TEXT NOT NULL,
    "request_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_events_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "audit_events_school_id_created_at_idx" ON "audit_events"("school_id", "created_at");

-- AddForeignKey
ALTER TABLE "audit_events" ADD CONSTRAINT "audit_events_school_id_fkey" FOREIGN KEY ("school_id") REFERENCES "schools"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_events" ADD CONSTRAINT "audit_events_actor_id_fkey" FOREIGN KEY ("actor_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Tenant isolation, as in the init migration.
ALTER TABLE "audit_events" ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "audit_events"
    USING ("school_id" = current_school_id()) WITH CHECK ("school_id" = current_school_id());
