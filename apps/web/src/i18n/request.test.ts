import { describe, expect, it, vi } from "vitest";

import en from "../../messages/en.json";
import km from "../../messages/km.json";

import requestConfig from "./request";

vi.mock("next-intl/server", () => import("@/test/intl-server"));

/**
 * Runs the request config for a requested locale.
 *
 * @param requested - The locale from the URL, if any.
 * @returns The resolved locale and messages.
 */
function resolve(requested: string | undefined) {
  // The test double returns the raw callback; next-intl passes more fields that this config ignores.
  return (requestConfig as unknown as (p: { requestLocale: Promise<string | undefined> }) => Promise<unknown>)({
    requestLocale: Promise.resolve(requested),
  });
}

describe("request config", () => {
  it("loads Khmer messages when the URL asks for km", async () => {
    await expect(resolve("km")).resolves.toEqual({ locale: "km", messages: km });
  });

  it("falls back to English when the locale is unsupported", async () => {
    await expect(resolve("fr")).resolves.toEqual({ locale: "en", messages: en });
  });

  it("falls back to English when no locale is given", async () => {
    await expect(resolve(undefined)).resolves.toEqual({ locale: "en", messages: en });
  });
});
