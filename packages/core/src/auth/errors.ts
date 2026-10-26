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

/** The account helps run a school, so deleting it would leave the school without them; they leave its team first. */
export class AccountRunsSchoolError extends Error {
  override readonly name = "AccountRunsSchoolError";
}

/** The email typed to confirm deleting the account is not the account's. */
export class DeletionNotConfirmedError extends Error {
  override readonly name = "DeletionNotConfirmedError";
}
