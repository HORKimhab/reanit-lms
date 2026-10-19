import { screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { onApi, requestTo } from "@/test/api";
import { renderWithIntl } from "@/test/render";
import { signIn } from "@/test/session";
import { STAFF_SCHOOL } from "@/test/staff";

import DashboardCoupons from "./page";

vi.mock("next/headers", () => import("@/test/headers"));
vi.mock("next-intl/server", () => import("@/test/intl-server"));

// The page only composes CouponTable and CouponForm, which have their own tests; its role branch is tested here.
describe("DashboardCoupons", () => {
  it.each(["owner", "admin"])("shows the coupons and the new-coupon form to an %s", async (role) => {
    signIn();
    onApi("GET /schools/current", Response.json({ school: STAFF_SCHOOL, role }));
    onApi("GET /coupons", Response.json({ coupons: [] }));

    renderWithIntl(await DashboardCoupons());

    expect(await screen.findByRole("button", { name: "Create coupon" })).toBeInTheDocument();
  });

  it("tells an instructor they cannot manage coupons, without asking the API for them", async () => {
    signIn();
    onApi("GET /schools/current", Response.json({ school: STAFF_SCHOOL, role: "instructor" }));

    renderWithIntl(await DashboardCoupons());

    expect(await screen.findByText("Only the school's owner and admins can manage coupons.")).toBeInTheDocument();
    expect(requestTo("GET /coupons")).toBeUndefined();
  });
});
