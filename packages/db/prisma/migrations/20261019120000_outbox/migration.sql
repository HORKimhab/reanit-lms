-- CreateTable
CREATE TABLE "outbox_events" (
    "id" UUID NOT NULL,
    "school_id" UUID NOT NULL,
    "type" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "occurred_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "published_at" TIMESTAMP(3),

    CONSTRAINT "outbox_events_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "outbox_events_published_at_occurred_at_idx" ON "outbox_events"("published_at", "occurred_at");

-- CreateIndex
CREATE INDEX "outbox_events_school_id_idx" ON "outbox_events"("school_id");

-- AddForeignKey
ALTER TABLE "outbox_events" ADD CONSTRAINT "outbox_events_school_id_fkey" FOREIGN KEY ("school_id") REFERENCES "schools"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Tenant isolation: schools write their own events; the worker's relay reads every school's as the table owner.
ALTER TABLE "outbox_events" ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "outbox_events"
    USING ("school_id" = current_school_id()) WITH CHECK ("school_id" = current_school_id());
