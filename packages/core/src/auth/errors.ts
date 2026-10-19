/** Sign-up with an email that already has an account. */
export class EmailTakenError extends Error {
  override readonly name = "EmailTakenError";
}

/** Wrong email or password. Deliberately does not say which. */
export class InvalidCredentialsError extends Error {
  override readonly name = "InvalidCredentialsError";
}

/** Magic link that is unknown, already used or expired. */
export class InvalidMagicLinkError extends Error {
  override readonly name = "InvalidMagicLinkError";
}
