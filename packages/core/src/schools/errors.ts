/** Another school already uses the requested subdomain. */
export class SubdomainTakenError extends Error {
  override readonly name = "SubdomainTakenError";
}

/** The user runs no school: they are not an owner, admin or instructor anywhere. */
export class NotSchoolStaffError extends Error {
  override readonly name = "NotSchoolStaffError";
}

/** No school has the given subdomain. */
export class SchoolNotFoundError extends Error {
  override readonly name = "SchoolNotFoundError";
}

/** Custom domains are not set up on this deployment (no certificate provider). */
export class CustomDomainsUnavailableError extends Error {
  override readonly name = "CustomDomainsUnavailableError";
}

/** The hostname is the platform's own domain or one of its subdomains. */
export class DomainNotAllowedError extends Error {
  override readonly name = "DomainNotAllowedError";
}

/** Another school has already verified the hostname. */
export class DomainTakenError extends Error {
  override readonly name = "DomainTakenError";
}

/** The school already has a custom domain; it must remove it before adding another. */
export class SchoolHasDomainError extends Error {
  override readonly name = "SchoolHasDomainError";
}

/** The school has no custom domain, or no school has verified the hostname. */
export class DomainNotFoundError extends Error {
  override readonly name = "DomainNotFoundError";
}

/** The verification TXT record was not found at the hostname yet. */
export class DomainNotVerifiedError extends Error {
  override readonly name = "DomainNotVerifiedError";
}

/** The invited email already belongs to one of the school's staff. */
export class AlreadyTeamMemberError extends Error {
  override readonly name = "AlreadyTeamMemberError";
}

/** The user is not one of the school's staff. */
export class TeamMemberNotFoundError extends Error {
  override readonly name = "TeamMemberNotFoundError";
}

/** The school's owner can't be removed or given another role. */
export class OwnerLockedError extends Error {
  override readonly name = "OwnerLockedError";
}

/** No invite has the token: it never existed, was replaced by a newer one, or was accepted. */
export class InviteNotFoundError extends Error {
  override readonly name = "InviteNotFoundError";
}

/** The invite's link is past its expiry; the school has to invite again. */
export class InviteExpiredError extends Error {
  override readonly name = "InviteExpiredError";
}

/** The signed-in account's email is not the one the invite was sent to. */
export class InviteEmailMismatchError extends Error {
  override readonly name = "InviteEmailMismatchError";
}

/** What a plan limits. */
export type PlanLimit = "publishedCourses" | "teamMembers" | "customDomain" | "offlineQr";

/** The school's plan does not allow this addition; a higher plan does. */
export class PlanLimitError extends Error {
  override readonly name = "PlanLimitError";

  /**
   * Records which limit was reached.
   *
   * @param limit The limit.
   */
  constructor(readonly limit: PlanLimit) {
    super(`Plan limit reached: ${limit}`);
  }
}

/** The school has no such plan payment. */
export class PlanPaymentNotFoundError extends Error {
  override readonly name = "PlanPaymentNotFoundError";
}

/** The method cannot take a plan payment: not configured, not in dollars, or card-only one-time. */
export class PlanPaymentMethodUnavailableError extends Error {
  override readonly name = "PlanPaymentMethodUnavailableError";
}

/** The plan payment is not a pending payment to the platform's QR, so it cannot be submitted, confirmed or rejected. */
export class PlanPaymentClosedError extends Error {
  override readonly name = "PlanPaymentClosedError";
}
