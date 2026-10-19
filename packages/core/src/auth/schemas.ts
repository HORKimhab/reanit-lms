import { z } from "zod";

/** NIST SP 800-63B minimum. */
export const PASSWORD_MIN_LENGTH = 8;
/** Caps hashing work per request. */
export const PASSWORD_MAX_LENGTH = 128;
const NAME_MAX_LENGTH = 100;

/** Email, trimmed and lower-cased so one address maps to one account. */
export const emailSchema = z.string().trim().toLowerCase().pipe(z.email());

/** Sign-up form input. */
export const signUpSchema = z.object({
  name: z.string().trim().min(1).max(NAME_MAX_LENGTH),
  email: emailSchema,
  password: z.string().min(PASSWORD_MIN_LENGTH).max(PASSWORD_MAX_LENGTH),
});

/** Login form input. Only length is capped: a wrong password is just a failed login. */
export const logInSchema = z.object({
  email: emailSchema,
  password: z.string().min(1).max(PASSWORD_MAX_LENGTH),
});

/** Parsed sign-up input. */
export type SignUpInput = z.infer<typeof signUpSchema>;
/** Parsed login input. */
export type LogInInput = z.infer<typeof logInSchema>;
