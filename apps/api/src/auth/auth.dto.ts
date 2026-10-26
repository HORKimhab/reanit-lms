import { deleteAccountSchema, emailSchema, logInSchema, signUpSchema } from "@reanit/core/auth";
import { EMAIL_LOCALES } from "@reanit/core/notifications";
import { z } from "zod";

import { createZodDto } from "../http/zod-dto";

/** `POST /auth/sign-up` body. */
export class SignUpBody extends createZodDto(signUpSchema) {}

/** `POST /auth/login` body. */
export class LogInBody extends createZodDto(logInSchema) {}

/** `POST /auth/magic-link` body. */
export class MagicLinkBody extends createZodDto(
  z.object({
    email: emailSchema,
    /** Local path to land on after signing in; anything else falls back to home. */
    next: z.string().optional(),
    /** Language of the email. */
    locale: z.enum(EMAIL_LOCALES).default("en"),
  }),
) {}

/** `GET /auth/magic-link/verify` query, as the emailed link carries it. */
export class VerifyMagicLinkQuery extends createZodDto(
  z.object({ token: z.string().optional(), next: z.string().optional() }),
) {}

/** The signed-in user, as every auth response returns it. */
export class SessionResponse extends createZodDto(
  z.object({ user: z.object({ id: z.uuid(), email: z.string(), name: z.string().nullable() }) }),
) {}

/** `DELETE /me` body: the account's email, typed again to confirm. */
export class DeleteAccountBody extends createZodDto(deleteAccountSchema) {}

const isoDate = z.iso.datetime();
const money = z.object({ amount: z.number().int(), currency: z.string() });

/** Everything stored about the signed-in person, across every school, with dates as ISO strings. */
export class DataExportResponse extends createZodDto(
  z.object({
    exportedAt: isoDate,
    account: z.object({ id: z.uuid(), email: z.string(), name: z.string().nullable(), createdAt: isoDate }),
    memberships: z.array(z.object({ school: z.string(), role: z.string(), joinedAt: isoDate })),
    enrollments: z.array(
      z.object({
        school: z.string(),
        course: z.string(),
        source: z.string(),
        enrolledAt: isoDate,
        completedAt: isoDate.nullable(),
        lessons: z.array(z.object({ lesson: z.string(), videoPositionSeconds: z.number().int(), completedAt: isoDate.nullable() })),
      }),
    ),
    orders: z.array(
      z.object({
        school: z.string(),
        status: z.string(),
        paymentMethod: z.string(),
        total: money,
        items: z.array(money.extend({ course: z.string() })),
        createdAt: isoDate,
        paidAt: isoDate.nullable(),
      }),
    ),
    quizAttempts: z.array(
      z.object({ school: z.string(), lesson: z.string(), scorePercent: z.number().int(), isPassed: z.boolean(), answers: z.unknown(), createdAt: isoDate }),
    ),
    comments: z.array(z.object({ school: z.string(), lesson: z.string(), body: z.string(), createdAt: isoDate })),
    certificates: z.array(z.object({ id: z.uuid(), school: z.string(), studentName: z.string(), courseTitle: z.string(), issuedAt: isoDate })),
  }),
) {}
