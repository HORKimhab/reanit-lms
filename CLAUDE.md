# Reanit LMS

Multi-tenant course platform (Teachable-like). Design doc: `README.md`. Planning stage, so check the real tree before assuming a path exists.

Rules:
- Every tenant table has `school_id` + RLS. Use only the tenant-scoped client from `@reanit/db`.
- Enroll students only from a confirmed payment (a gateway webhook or status check, or staff confirming an offline QR payment, audited), processed idempotently through the one payment confirmation.
- Money is integer minor units + ISO currency code.
- pnpm + Node 24 only. No other lockfiles.
- Adding or changing a skill, command or hook: in the same commit, update README §10 (skill table + command table) and the skill's `description` and modes.

Before creating or moving files, use the `project-structure` skill.
