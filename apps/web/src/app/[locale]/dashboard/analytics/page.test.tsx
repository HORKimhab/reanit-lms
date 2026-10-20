import { screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { onApi, problem, requestTo } from "@/test/api";
import { renderWithIntl, routeProps } from "@/test/render";
import { signIn } from "@/test/session";

import DashboardAnalytics from "./page";

vi.mock("next/headers", () => import("@/test/headers"));
vi.mock("next-intl/server", () => import("@/test/intl-server"));

// The page only composes RangeFilter and SalesReport, which have their own tests; its query and refused-range branches are tested here.
describe("DashboardAnalytics", () => {
  it("asks for the default range when the query is malformed", async () => {
    signIn();
    onApi("GET /stats/sales", problem(400));

    await DashboardAnalytics({ ...routeProps({}), searchParams: Promise.resolve({ from: "yesterday" }) });

    expect(new URL(requestTo("GET /stats/sales")?.url ?? "").search).toBe("");
  });

  it("explains a range the API refuses, keeping the range in the filter", async () => {
    signIn();
    onApi("GET /stats/sales", problem(400, "urn:reanit:problem:invalid-stats-range"));

    renderWithIntl(await DashboardAnalytics({ ...routeProps({}), searchParams: Promise.resolve({ from: "2026-10-05", to: "2026-10-01" }) }));

    expect(await screen.findByRole("alert")).toHaveTextContent("Pick a range of up to a year that ends after it starts.");
    expect(screen.getByLabelText("From")).toHaveValue("2026-10-05");
  });
});
