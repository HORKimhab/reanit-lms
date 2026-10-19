import { emailSchema, logInSchema, signUpSchema } from "@reanit/core/auth";
import { z } from "zod";

import { createZodDto } from "../http/zod-dto";
import { EMAIL_LOCALES } from "./magic-link-email";

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
