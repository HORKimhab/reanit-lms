import { resolveTxt } from "node:dns/promises";

import type { DnsLookup } from "@reanit/core/schools";

/** Resolver error codes that mean the name has no TXT records (yet), not that DNS failed. */
const NO_RECORD_CODES = new Set(["ENODATA", "ENOTFOUND"]);

/**
 * Reads TXT records from public DNS with `node:dns`, so the domain service can check ownership records.
 *
 * @param resolve Resolves a name's TXT records as chunk lists; `node:dns` outside tests.
 * @returns The lookup.
 */
export function createDnsLookup(resolve: (name: string) => Promise<string[][]> = resolveTxt): DnsLookup {
  return {
    /**
     * Lists the TXT records at a name, joining the 255-byte chunks DNS splits long records into.
     *
     * @param name Fully qualified name.
     * @returns The records; empty when the name has none or does not exist.
     * @throws {Error} When DNS cannot be queried (timeout, server failure).
     */
    async txtRecords(name: string) {
      try {
        return (await resolve(name)).map((chunks) => chunks.join(""));
      } catch (error) {
        if (NO_RECORD_CODES.has((error as NodeJS.ErrnoException).code ?? "")) return [];
        throw error;
      }
    },
  };
}
