import { screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { onApi } from "@/test/api";
import { BUNDLE, BUNDLE_COURSES } from "@/test/bundles";
import { renderWithIntl, routeProps } from "@/test/render";
import { signIn } from "@/test/session";
import { STAFF_SCHOOL } from "@/test/staff";

import BundleEditorPage from "./page";

vi.mock("next/headers", () => import("@/test/headers"));
vi.mock("next-intl/server", () => import("@/test/intl-server"));

const PROPS = routeProps({ bundle: "design-kit" });

/**
 * Answers the editor's API calls for a staff member with the given role.
 *
 * @param role Their role in the school.
 */
function answerAs(role: string) {
  signIn();
  onApi("GET /schools/current", Response.json({ school: STAFF_SCHOOL, role }));
  onApi("GET /bundles/by-slug/design-kit", Response.json({ bundle: BUNDLE }));
  onApi("GET /courses", Response.json({ courses: BUNDLE_COURSES.map((course) => ({ ...course, description: null, status: "published" })) }));
}

// The page only composes BundleForm and BundlePriceForm, which have their own tests; its role branch is tested here.
describe("BundleEditorPage", () => {
  it("lets an owner set the price", async () => {
    answerAs("owner");

    renderWithIntl(await BundleEditorPage(PROPS));

    expect(await screen.findByRole("button", { name: "Save price" })).toBeInTheDocument();
  });

  it("tells an instructor only owners and admins set prices", async () => {
    answerAs("instructor");

    renderWithIntl(await BundleEditorPage(PROPS));

    expect(await screen.findByText("Only the school's owner and admins can set prices.")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Save price" })).not.toBeInTheDocument();
  });
});
