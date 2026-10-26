// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";

import { onApi, problem, requestTo } from "@/test/api";
import { NotFoundError, RedirectError } from "@/test/navigation";
import { ORDER, ORDER_JSON } from "@/test/orders";
import { signIn } from "@/test/session";

import { getSchoolOrder, listMyOrders, listSchoolOrders, orderFiltersFrom, purchasesPageFrom } from "./orders";

vi.mock("next/headers", () => import("@/test/headers"));

beforeEach(() => {
  signIn();
});

describe("purchasesPageFrom", () => {
  it("reads the page, and the first page from a malformed one", () => {
    expect(purchasesPageFrom({ page: "3" })).toBe(3);
    expect(purchasesPageFrom({ page: "zero" })).toBe(1);
  });
});

describe("orderFiltersFrom", () => {
  it("reads the filters, ignoring the empty values of the form's Any choices", () => {
    expect(orderFiltersFrom({ status: "refunded", courseId: "", currency: "KHR", from: "2026-10-01", to: "", page: "2" })).toEqual({
      status: "refunded",
      currency: "KHR",
      from: "2026-10-01",
      page: 2,
    });
  });

  it("falls back to the first page of every order for a malformed query", () => {
    expect(orderFiltersFrom({ status: "shipped" })).toEqual({ page: 1 });
  });
});

describe("listMyOrders", () => {
  it("returns the student's page of orders with dates", async () => {
    onApi("GET /schools/by-subdomain/angkor/orders", Response.json({ orders: [ORDER_JSON], total: 1, page: 2, pageSize: 50 }));

    expect(await listMyOrders("angkor", 2, "/s/angkor/purchases")).toEqual({ orders: [ORDER], total: 1, page: 2, pageSize: 50 });
    // listMyOrders awaited the answer, so the request was sent.
    expect(new URL(requestTo("GET /schools/by-subdomain/angkor/orders")!.url).search).toBe("?page=2");
  });

  it("sends a signed-out visitor to log in", async () => {
    onApi("GET /schools/by-subdomain/angkor/orders", problem(401));

    await expect(listMyOrders("angkor", 1, "/s/angkor/purchases")).rejects.toThrow(RedirectError);
  });
});

describe("listSchoolOrders", () => {
  it("sends the filters and returns the page with dates", async () => {
    onApi("GET /orders", Response.json({ orders: [ORDER_JSON], total: 1, page: 1, pageSize: 50 }));

    expect((await listSchoolOrders({ status: "paid", currency: "USD", page: 1 })).orders).toEqual([ORDER]);
    // listSchoolOrders awaited the answer, so the request was sent.
    expect(new URL(requestTo("GET /orders")!.url).searchParams.toString()).toBe("status=paid&currency=USD&page=1");
  });
});

describe("getSchoolOrder", () => {
  it("returns the order with dates", async () => {
    onApi(`GET /orders/${ORDER.id}`, Response.json({ order: { ...ORDER_JSON, status: "refunded", refundedAt: "2026-10-21T09:00:00.000Z" } }));

    expect(await getSchoolOrder(ORDER.id)).toEqual({ ...ORDER, status: "refunded", refundedAt: new Date("2026-10-21T09:00:00Z") });
  });

  it.each([400, 404])("is not found when the API answers %i", async (status) => {
    onApi(`GET /orders/${ORDER.id}`, problem(status));

    await expect(getSchoolOrder(ORDER.id)).rejects.toThrow(NotFoundError);
  });
});
