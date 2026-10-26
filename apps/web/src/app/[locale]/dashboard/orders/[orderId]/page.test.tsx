import { screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { onApi, problem, requestTo } from "@/test/api";
import { NotFoundError } from "@/test/navigation";
import { ORDER, ORDER_JSON } from "@/test/orders";
import { renderWithIntl } from "@/test/render";
import { signInAsStaff } from "@/test/staff";

import DashboardOrder from "./page";

vi.mock("next/headers", () => import("@/test/headers"));
vi.mock("next-intl/server", () => import("@/test/intl-server"));

/**
 * Renders the page for the test order.
 *
 * @returns The rendered page's promise.
 */
async function visit() {
  return DashboardOrder({ params: Promise.resolve({ locale: "en", orderId: ORDER.id }), searchParams: Promise.resolve({}) });
}

// The page only composes OrderBuyer, ReceiptCard and RefundButton; its role, not-found and refundable branches are tested here.
describe("DashboardOrder", () => {
  it("shows an owner the order's buyer and receipt", async () => {
    signInAsStaff("owner");
    onApi(`GET /orders/${ORDER.id}`, Response.json({ order: ORDER_JSON }));

    renderWithIntl(await visit());

    expect(await screen.findByRole("region", { name: "Buyer" })).toHaveTextContent("sokha@example.com");
    expect(screen.getByRole("article", { name: "Order 6F1C1F3E" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Refund order" })).toBeInTheDocument();
  });

  it("offers no refund for an order already refunded", async () => {
    signInAsStaff("owner");
    onApi(`GET /orders/${ORDER.id}`, Response.json({ order: { ...ORDER_JSON, status: "refunded", refundedAt: "2026-10-21T09:00:00.000Z" } }));

    renderWithIntl(await visit());

    expect(await screen.findByRole("article", { name: "Order 6F1C1F3E" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Refund order" })).not.toBeInTheDocument();
  });

  it("is not found for an order the school does not have", async () => {
    signInAsStaff("admin");
    onApi(`GET /orders/${ORDER.id}`, problem(404, "urn:reanit:problem:order-not-found"));

    await expect(visit()).rejects.toThrow(NotFoundError);
  });

  it("tells an instructor they cannot see orders, without asking the API for it", async () => {
    signInAsStaff("instructor");

    renderWithIntl(await visit());

    expect(await screen.findByText("Only the school's owner and admins can see its orders.")).toBeInTheDocument();
    expect(requestTo(`GET /orders/${ORDER.id}`)).toBeUndefined();
  });
});
