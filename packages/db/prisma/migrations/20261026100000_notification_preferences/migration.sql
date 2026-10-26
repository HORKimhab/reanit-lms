-- Staff email settings (WRK-04): one row per staff member and school, made when their first staff email is sent.
-- CreateTable
CREATE TABLE "notification_preferences" (
    "id" UUID NOT NULL,
    "school_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "new_sale" BOOLEAN NOT NULL DEFAULT true,
    "new_comment" BOOLEAN NOT NULL DEFAULT true,
    "course_completed" BOOLEAN NOT NULL DEFAULT true,
    "locale" TEXT NOT NULL DEFAULT 'en',
    "unsubscribe_token" UUID NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "notification_preferences_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "notification_preferences_unsubscribe_token_key" ON "notification_preferences"("unsubscribe_token");

-- CreateIndex
CREATE UNIQUE INDEX "notification_preferences_school_id_user_id_key" ON "notification_preferences"("school_id", "user_id");

-- AddForeignKey
ALTER TABLE "notification_preferences" ADD CONSTRAINT "notification_preferences_school_id_fkey" FOREIGN KEY ("school_id") REFERENCES "schools"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notification_preferences" ADD CONSTRAINT "notification_preferences_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Tenant isolation, as in the init migration.
ALTER TABLE "notification_preferences" ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "notification_preferences"
    USING ("school_id" = current_school_id()) WITH CHECK ("school_id" = current_school_id());
