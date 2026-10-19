export { EmailTakenError, InvalidCredentialsError, InvalidMagicLinkError } from "./errors";
export type { AuthStore, AuthUser, Clock, MailMessage, Mailer } from "./ports";
export { emailSchema, logInSchema, signUpSchema, type LogInInput, type SignUpInput } from "./schemas";
export { createAuthService, MAGIC_LINK_TTL_MS, type AuthService, type AuthSession } from "./service";
