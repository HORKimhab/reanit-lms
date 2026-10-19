import { screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { BUNDLE } from "@/test/bundles";
import { renderWithIntl } from "@/test/render";

import { BundleDetails } from "./bundle-details";

describe("BundleDetails", () => {
  it("shows the bundle, links each of its courses, and sends buyers to its checkout", async () => {
    renderWithIntl(<BundleDetails bundle={BUNDLE} schoolPath="/s/angkor" checkoutHref="/s/angkor/bundle-checkout/design-kit" />);

    expect(await screen.findByRole("heading", { level: 1, name: "Design Kit" })).toBeInTheDocument();
    expect(screen.getByText("2 courses in one bundle")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Logo Design" })).toHaveAttribute("href", "/s/angkor/courses/logo-design");
    expect(screen.getAllByRole("link", { name: "Enroll now" })[0]).toHaveAttribute("href", "/s/angkor/bundle-checkout/design-kit");
  });

  it("says a bundle without a price is coming soon, with nothing to buy", async () => {
    renderWithIntl(<BundleDetails bundle={{ ...BUNDLE, price: null }} schoolPath="/s/angkor" checkoutHref="/s/angkor/bundle-checkout/design-kit" />);

    expect((await screen.findAllByText("Coming soon")).length).toBeGreaterThan(0);
    expect(screen.queryByRole("link", { name: "Enroll now" })).not.toBeInTheDocument();
  });

  it("uses Khmer text when the locale is km", async () => {
    renderWithIntl(<BundleDetails bundle={BUNDLE} schoolPath="/s/angkor" checkoutHref="/s/angkor/bundle-checkout/design-kit" />, { locale: "km" });

    expect(await screen.findByText("វគ្គសិក្សាក្នុងកញ្ចប់នេះ")).toBeInTheDocument();
  });
});
