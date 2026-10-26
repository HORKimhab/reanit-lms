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
