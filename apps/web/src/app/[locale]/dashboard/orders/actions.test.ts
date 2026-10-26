// @vitest-environment node
import { revalidatePath } from "next/cache";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { onApi, problem, requestTo } from "@/test/api";
import { ORDER } from "@/test/orders";
import { signIn } from "@/test/session";

import { refundOrder, reviewOfflinePayment } from "./actions";

vi.mock("next/headers", () => import("@/test/headers"));
// Cache revalidation needs a running Next server; it is a boundary, so record calls instead.
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

const ROUTE = `POST /orders/${ORDER.id}/refund`;

beforeEach(() => {
  signIn();
});

describe("refundOrder", () => {
  it("refunds the order, saying whether staff paid back by hand, and refreshes the orders pages", async () => {
    onApi(ROUTE, new Response(null, { status: 204 }));

    await refundOrder(ORDER.id, true);

    expect(await requestTo(ROUTE)?.json()).toEqual({ isRefundedByHand: true });
    expect(revalidatePath).toHaveBeenCalledWith("/dashboard/orders", "layout");
  });

  it("shows an order refunded meanwhile as it now is", async () => {
    onApi(ROUTE, problem(409, "urn:reanit:problem:order-not-refundable"));

    await refundOrder(ORDER.id, false);

    expect(revalidatePath).toHaveBeenCalledWith("/dashboard/orders", "layout");
  });

  it("throws when the gateway refuses the refund", async () => {
    onApi(ROUTE, problem(500));

    await expect(refundOrder(ORDER.id, false)).rejects.toThrow("API answered 500");
    expect(revalidatePath).not.toHaveBeenCalled();
  });
});

describe("reviewOfflinePayment", () => {
  it.each([
    ["confirm", "confirm-payment"],
    ["reject", "reject-payment"],
  ] as const)("posts the %s decision and refreshes the orders pages", async (decision, path) => {
    onApi(`POST /orders/${ORDER.id}/${path}`, new Response(null, { status: 204 }));

    await reviewOfflinePayment(ORDER.id, decision);

    expect(requestTo(`POST /orders/${ORDER.id}/${path}`)).toBeDefined();
    expect(revalidatePath).toHaveBeenCalledWith("/dashboard/orders", "layout");
  });

  it("shows a payment another admin settled meanwhile as it now is", async () => {
    onApi(`POST /orders/${ORDER.id}/confirm-payment`, problem(409, "urn:reanit:problem:offline-payment-closed"));

    await reviewOfflinePayment(ORDER.id, "confirm");

    expect(revalidatePath).toHaveBeenCalledWith("/dashboard/orders", "layout");
  });
});

