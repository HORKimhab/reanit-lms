/** Another school already uses the requested subdomain. */
export class SubdomainTakenError extends Error {
  override readonly name = "SubdomainTakenError";
}

/** The user runs no school: they are not an owner, admin or instructor anywhere. */
export class NotSchoolStaffError extends Error {
  override readonly name = "NotSchoolStaffError";
}
