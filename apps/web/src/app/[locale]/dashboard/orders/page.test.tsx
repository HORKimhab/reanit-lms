import { screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { onApi, requestTo } from "@/test/api";
import { renderWithIntl } from "@/test/render";
import { signInAsStaff } from "@/test/staff";

import DashboardOrders from "./page";

vi.mock("next/headers", () => import("@/test/headers"));
vi.mock("next-intl/server", () => import("@/test/intl-server"));

/**
 * Renders the page for a URL query.
 *
 * @param query - The search params.
 */
async function visit(query: Record<string, string> = {}) {
  renderWithIntl(await DashboardOrders({ params: Promise.resolve({ locale: "en" }), searchParams: Promise.resolve(query) }));
}

// The page only composes OrderList, which has its own tests; its role branch and query parsing are tested here.
describe("DashboardOrders", () => {
  it("lists an owner's orders with the filters from the URL", async () => {
    signInAsStaff("owner");
    onApi("GET /orders", Response.json({ orders: [], total: 0, page: 1, pageSize: 50 }));
    onApi("GET /courses", Response.json({ courses: [] }));

    await visit({ status: "refunded", courseId: "" });

    expect(await screen.findByText("No orders found")).toBeInTheDocument();
    // The page awaited the list, so the request was sent.
    expect(new URL(requestTo("GET /orders")!.url).search).toBe("?status=refunded&page=1");
  });

  it("tells an instructor they cannot see orders, without asking the API for them", async () => {
    signInAsStaff("instructor");

    await visit();

    expect(await screen.findByText("Only the school's owner and admins can see its orders.")).toBeInTheDocument();
    expect(requestTo("GET /orders")).toBeUndefined();
  });
});
