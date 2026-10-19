import { screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { router } from "@/test/navigation";
import { renderWithIntl } from "@/test/render";

import { PAYMENT_POLL_MS } from "./khqr-payment";
import { OrderStatus } from "./order-status";

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
});

describe("OrderStatus", () => {
  it("waits for a pending payment and re-checks it every few seconds", async () => {
    renderWithIntl(<OrderStatus status="pending" school="angkor" />);
    await vi.advanceTimersByTimeAsync(0);

    expect(screen.getByRole("status")).toHaveTextContent("Waiting for your payment…");
    await vi.advanceTimersByTimeAsync(PAYMENT_POLL_MS * 2);
    expect(router.refresh).toHaveBeenCalledTimes(2);
  });

  it("sends a paid buyer to their courses and stops re-checking", async () => {
    renderWithIntl(<OrderStatus status="paid" school="angkor" />);
    await vi.advanceTimersByTimeAsync(0);

    expect(screen.getByRole("status")).toHaveTextContent("Payment received. You're enrolled!");
    expect(screen.getByRole("link", { name: "Go to my courses" })).toHaveAttribute("href", "/s/angkor/my-courses");
    await vi.advanceTimersByTimeAsync(PAYMENT_POLL_MS);
    expect(router.refresh).not.toHaveBeenCalled();
  });

  it.each([
    ["failed", "The payment didn't go through."],
    ["refunded", "This order was refunded."],
  ] as const)("offers the catalog again for a %s order", async (status, text) => {
    renderWithIntl(<OrderStatus status={status} school="angkor" />);
    await vi.advanceTimersByTimeAsync(0);

    expect(screen.getByRole("status")).toHaveTextContent(text);
    expect(screen.getByRole("link", { name: "Browse courses" })).toHaveAttribute("href", "/s/angkor");
  });
});
