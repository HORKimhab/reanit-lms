import { describe, expect, it, vi } from "vitest";

import { createDnsLookup } from "./dns-lookup";

/**
 * Makes a resolver error with a `node:dns` code.
 *
 * @param code The error code.
 * @returns The error.
 */
function dnsError(code: string) {
  return Object.assign(new Error(`queryTxt ${code}`), { code });
}

describe("createDnsLookup", () => {
  it("joins each record's chunks", async () => {
    const resolve = vi.fn().mockResolvedValue([["reanit-verification=", "token-1"], ["v=spf1 -all"]]);

    expect(await createDnsLookup(resolve).txtRecords("_reanit-verification.learn.angkor.com")).toEqual([
      "reanit-verification=token-1",
      "v=spf1 -all",
    ]);
    expect(resolve).toHaveBeenCalledWith("_reanit-verification.learn.angkor.com");
  });

  it.each(["ENODATA", "ENOTFOUND"])("returns no records when DNS answers %s", async (code) => {
    const resolve = vi.fn().mockRejectedValue(dnsError(code));

    expect(await createDnsLookup(resolve).txtRecords("_reanit-verification.learn.angkor.com")).toEqual([]);
  });

  it("throws when DNS fails", async () => {
    const resolve = vi.fn().mockRejectedValue(dnsError("ETIMEOUT"));

    await expect(createDnsLookup(resolve).txtRecords("_reanit-verification.learn.angkor.com")).rejects.toThrow("ETIMEOUT");
  });
});
