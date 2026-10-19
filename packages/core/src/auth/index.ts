export { safeRedirectPath } from "./redirect";
export { EmailTakenError, InvalidCredentialsError, InvalidMagicLinkError } from "./errors";
export type { AuthStore, AuthUser, Clock, MailMessage, Mailer } from "./ports";
export {
  emailSchema,
  logInSchema,
  PASSWORD_MAX_LENGTH,
  PASSWORD_MIN_LENGTH,
  signUpSchema,
  type LogInInput,
  type SignUpInput,
} from "./schemas";
export { createAuthService, MAGIC_LINK_TTL_MS, type AuthService, type AuthSession } from "./service";
