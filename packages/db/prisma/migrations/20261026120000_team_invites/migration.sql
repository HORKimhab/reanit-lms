-- Team invites (API-24): one pending invitation per school and email, found by the emailed token's hash.

-- CreateTable
CREATE TABLE "team_invites" (
    "id" UUID NOT NULL,
    "school_id" UUID NOT NULL,
    "email" TEXT NOT NULL,
    "role" "MembershipRole" NOT NULL,
    "token_hash" TEXT NOT NULL,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "team_invites_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "team_invites_token_hash_key" ON "team_invites"("token_hash");

-- CreateIndex
CREATE UNIQUE INDEX "team_invites_school_id_email_key" ON "team_invites"("school_id", "email");

-- AddForeignKey
ALTER TABLE "team_invites" ADD CONSTRAINT "team_invites_school_id_fkey" FOREIGN KEY ("school_id") REFERENCES "schools"("id") ON DELETE CASCADE ON UPDATE CASCADE;


-- Tenant isolation, as in the init migration. Accepting looks an invite up by its token across schools
-- (the invitee has no school yet), through the unscoped client, like the outbox relay.
ALTER TABLE "team_invites" ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "team_invites"
    USING ("school_id" = current_school_id()) WITH CHECK ("school_id" = current_school_id());
