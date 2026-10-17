# Reanit LMS

Multi-tenant course platform (Teachable-like). Design doc: `README.md`. Planning stage, so check the real tree before assuming a path exists.

Rules:
- Every tenant table has `school_id` + RLS. Use only the tenant-scoped client from `@reanit/db`.
- Enroll students only from a confirmed payment webhook, processed idempotently.
- Money is integer minor units + ISO currency code.
- pnpm + Node 24 only. No other lockfiles.

Before creating or moving files, use the `project-structure` skill.
