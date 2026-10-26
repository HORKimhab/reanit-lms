export { safeRedirectPath } from "./redirect";
export { createAccountService, createErasureCleanup, deleteAccountSchema, type AccountService, type DeleteAccountInput } from "./account";
export { AccountRunsSchoolError, DeletionNotConfirmedError, EmailTakenError, InvalidCredentialsError, InvalidMagicLinkError } from "./errors";
export type { AccountStore, AuthStore, AuthUser, Clock, MailMessage, Mailer, UserDataExport } from "./ports";
export {
  emailSchema,
  logInSchema,
  PASSWORD_MAX_LENGTH,
  PASSWORD_MIN_LENGTH,
  signUpSchema,
  type LogInInput,
  type SignUpInput,
} from "./schemas";
export { createAuthService, MAGIC_LINK_TTL_MS, SESSION_COOKIE, type AuthService, type AuthSession } from "./service";
