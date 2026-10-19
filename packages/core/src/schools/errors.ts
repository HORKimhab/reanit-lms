/** Another school already uses the requested subdomain. */
export class SubdomainTakenError extends Error {
  override readonly name = "SubdomainTakenError";
}
