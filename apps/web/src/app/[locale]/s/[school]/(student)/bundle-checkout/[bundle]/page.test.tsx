// @vitest-environment node
import { describe, expect, it, vi } from "vitest";

import { onApi } from "@/test/api";
import { BUNDLE } from "@/test/bundles";
import { NotFoundError, RedirectError } from "@/test/navigation";
import { routeProps } from "@/test/render";
import { signIn } from "@/test/session";

import BundleCheckoutPage from "./page";

vi.mock("next/headers", () => import("@/test/headers"));
vi.mock("next-intl/server", () => import("@/test/intl-server"));

const PROPS = routeProps({ school: "angkor", bundle: "design-kit" });

// The page only composes CheckoutForm, which has its own tests; its sign-in and not-for-sale branches are tested here.
describe("BundleCheckoutPage", () => {
  it("sends a signed-out visitor to log in and back", async () => {
    await expect(BundleCheckoutPage(PROPS)).rejects.toEqual(new RedirectError("/login?next=%2Fs%2Fangkor%2Fbundle-checkout%2Fdesign-kit"));
  });

  it("404s when the bundle has no price", async () => {
    signIn();
    onApi("GET /schools/by-subdomain/angkor/bundles/design-kit", Response.json({ bundle: { ...BUNDLE, price: null } }));
    onApi("GET /schools/by-subdomain/angkor/bundles/design-kit/offer", Response.json({ price: null, methods: [], discount: null }));

    await expect(BundleCheckoutPage(PROPS)).rejects.toBeInstanceOf(NotFoundError);
  });
});
