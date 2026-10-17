# Feature
- [ ] Logic + unit tests in `packages/core/<module>`
- [ ] Schema/migration in `packages/db` (see Migration)
- [ ] API + UI in `apps/web`. Public pages use ISR; dashboard and player render dynamically.
- [ ] Side effects go out as an outbox event and are handled by an `apps/worker` job. Nothing inline in the request.
- [ ] Rate limiting on auth and checkout; audit log for admin and instructor actions

# Migration
- [ ] Tenant table has `school_id` + index + RLS policy
- [ ] Money is `int` minor units + `currency`
- [ ] Seed updated
- [ ] Integration test against real Postgres

# Worker job
- [ ] Idempotency key
- [ ] Retries + dead-letter queue
- [ ] Webhook enrollment only after the payment is confirmed
