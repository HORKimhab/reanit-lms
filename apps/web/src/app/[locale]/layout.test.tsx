import { describe, expect, it, vi } from "vitest";

import { NotFoundError } from "@/test/navigation";

import LocaleLayout, { generateMetadata, generateStaticParams } from "./layout";

vi.mock("next-intl/server", () => import("@/test/intl-server"));
/**
 * Stands in for a next/font loader, which only works inside the Next build.
 *
 * @returns A font with a CSS variable class.
 */
function fakeFont() {
  return { variable: "font-test" };
}

vi.mock("next/font/google", () => ({ Inter: fakeFont, Kantumruy_Pro: fakeFont }));

describe("generateStaticParams", () => {
  it("pre-renders every supported locale", () => {
    expect(generateStaticParams()).toEqual([{ locale: "en" }, { locale: "km" }]);
  });
});

describe("generateMetadata", () => {
  it("returns the title and description in the requested locale", async () => {
    await expect(generateMetadata({ params: Promise.resolve({ locale: "km" }) })).resolves.toEqual({
      title: "Reanit",
      description: "បង្កើត លក់ និងបង្រៀនវគ្គសិក្សាអនឡាញ។",
    });
  });

  it("404s when the locale is unsupported", async () => {
    await expect(generateMetadata({ params: Promise.resolve({ locale: "fr" }) })).rejects.toBeInstanceOf(NotFoundError);
  });
});

describe("LocaleLayout", () => {
  it("404s when the locale is unsupported", async () => {
    await expect(LocaleLayout({ children: null, params: Promise.resolve({ locale: "fr" }) })).rejects.toBeInstanceOf(
      NotFoundError,
    );
  });
});
