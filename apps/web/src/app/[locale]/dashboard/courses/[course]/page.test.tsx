import { screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { onApi, requestTo } from "@/test/api";
import { renderWithIntl, routeProps } from "@/test/render";
import { signInAsStaff } from "@/test/staff";

import CourseBuilderPage from "./page";

vi.mock("next/headers", () => import("@/test/headers"));
vi.mock("next-intl/server", () => import("@/test/intl-server"));

const COURSE_ID = "6f1c1f3e-1c5a-4a8e-9a39-2c1f1d9e0a20";
const PROPS = routeProps({ course: "brand" });

/**
 * Answers the builder's API calls for a staff member with the given role.
 *
 * @param role - Their role in the school.
 */
function answerAs(role: "owner" | "instructor") {
  signInAsStaff(role);
  onApi("GET /courses/by-slug/brand", Response.json({ course: { id: COURSE_ID, title: "Brand", slug: "brand", description: null, status: "draft", sections: [] } }));
  onApi(`GET /courses/${COURSE_ID}/price`, Response.json({ price: { amount: 1500, currency: "USD", billing: { kind: "recurring", interval: "month" } } }));
}

// The page only composes the course forms, which have their own tests; its role branch is tested here.
describe("CourseBuilderPage", () => {
  it("lets an owner set the course's price, starting from the current one", async () => {
    answerAs("owner");

    renderWithIntl(await CourseBuilderPage(PROPS));

    expect(await screen.findByRole("radio", { name: "Subscription" })).toBeChecked();
    expect(screen.getByRole("button", { name: "Save price" })).toBeInTheDocument();
  });

  it("tells an instructor only owners and admins set prices, without asking for the price", async () => {
    answerAs("instructor");

    renderWithIntl(await CourseBuilderPage(PROPS));

    expect(await screen.findByText("Only the school's owner and admins can set prices.")).toBeInTheDocument();
    expect(requestTo(`GET /courses/${COURSE_ID}/price`)).toBeUndefined();
  });
});
