// @vitest-environment node
import { describe, expect, it, vi } from "vitest";

import { onApi, problem } from "@/test/api";
import { NotFoundError, RedirectError } from "@/test/navigation";
import { routeProps } from "@/test/render";
import { signIn } from "@/test/session";

import CheckoutPage from "./page";

vi.mock("next/headers", () => import("@/test/headers"));
vi.mock("next-intl/server", () => import("@/test/intl-server"));

const PROPS = routeProps({ school: "angkor", course: "brand" });

// The page only composes CheckoutForm, which has its own tests; its sign-in and not-for-sale branches are tested here.
describe("CheckoutPage", () => {
  it("sends a signed-out visitor to log in and back", async () => {
    await expect(CheckoutPage(PROPS)).rejects.toEqual(new RedirectError("/login?next=%2Fs%2Fangkor%2Fcheckout%2Fbrand"));
  });

  it("404s when the course has no price", async () => {
    signIn();
    onApi("GET /schools/by-subdomain/angkor/courses/brand", Response.json({ course: { id: "c", title: "Brand", slug: "brand", status: "published", description: null, sections: [] } }));
    onApi("GET /schools/by-subdomain/angkor/courses/brand/offer", Response.json({ price: null, methods: [] }));

    await expect(CheckoutPage(PROPS)).rejects.toBeInstanceOf(NotFoundError);
  });

  it("404s on an unknown course", async () => {
    signIn();
    onApi("GET /schools/by-subdomain/angkor/courses/brand", problem(404));
    onApi("GET /schools/by-subdomain/angkor/courses/brand/offer", problem(404));

    await expect(CheckoutPage(PROPS)).rejects.toBeInstanceOf(NotFoundError);
  });
});
