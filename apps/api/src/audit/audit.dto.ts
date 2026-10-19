import { AUDIT_ACTIONS, auditQuerySchema } from "@reanit/core/audit";
import { z } from "zod";

import { pageResponseSchema } from "../http/page-response";
import { createZodDto } from "../http/zod-dto";

/** `GET /audit-events` query. */
export class AuditQuery extends createZodDto(auditQuerySchema) {}

/** One page of the school's audit log, newest first. */
export class AuditEventsResponse extends createZodDto(
  pageResponseSchema(
    "entries",
    z.object({
      id: z.uuid(),
      actor: z.object({ id: z.uuid(), email: z.string(), name: z.string().nullable() }).nullable(),
      action: z.enum(AUDIT_ACTIONS),
      targetId: z.string(),
      requestId: z.string(),
      createdAt: z.iso.datetime(),
    }),
  ),
) {}
