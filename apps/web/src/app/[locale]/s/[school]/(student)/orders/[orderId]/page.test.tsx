// @vitest-environment node
import { describe, expect, it, vi } from "vitest";

import { onApi, problem } from "@/test/api";
import { NotFoundError } from "@/test/navigation";
import { routeProps } from "@/test/render";
import { signIn } from "@/test/session";

import OrderPage from "./page";

vi.mock("next/headers", () => import("@/test/headers"));
vi.mock("next-intl/server", () => import("@/test/intl-server"));

const ORDER_ID = "6f1c1f3e-1c5a-4a8e-9a39-2c1f1d9e0a05";

// The page only composes OrderStatus, which has its own tests; only its not-found branch is tested here.
describe("OrderPage", () => {
  it("404s on someone else's order", async () => {
    signIn();
    onApi(`GET /schools/by-subdomain/angkor/orders/${ORDER_ID}`, problem(404));

    await expect(OrderPage(routeProps({ school: "angkor", orderId: ORDER_ID }))).rejects.toBeInstanceOf(NotFoundError);
  });
});
