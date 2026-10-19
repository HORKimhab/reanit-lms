import { screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { router } from "@/test/navigation";
import { renderWithIntl } from "@/test/render";

import { KhqrPayment, PAYMENT_POLL_MS } from "./khqr-payment";

/**
 * Renders the code with a status check that answers as given.
 *
 * @param status - What the order's status reads.
 * @param locale - UI locale.
 * @returns The status check spy.
 */
async function renderCode(status: "pending" | "paid", locale: "en" | "km" = "en") {
  const checkStatus = vi.fn().mockResolvedValue(status);
  renderWithIntl(
    <KhqrPayment qr="00020101021229" expiresAt="2026-10-19T01:15:00.000Z" priceLabel="$49.00" orderHref="/s/angkor/orders/order-1" checkStatus={checkStatus} />,
    { locale },
  );
  await vi.advanceTimersByTimeAsync(0);
  return checkStatus;
}

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
});

describe("KhqrPayment", () => {
  it("shows the code to scan and until when it works", async () => {
    await renderCode("pending");

    expect(screen.getByRole("img", { name: "KHQR code to pay $49.00" })).toBeInTheDocument();
    expect(screen.getByText("The code works until 1:15 AM.")).toBeInTheDocument();
    expect(screen.getByRole("status")).toHaveTextContent("Waiting for your payment…");
  });

  it("keeps waiting while the order is pending", async () => {
    const checkStatus = await renderCode("pending");

    await vi.advanceTimersByTimeAsync(PAYMENT_POLL_MS * 2);

    expect(checkStatus).toHaveBeenCalledTimes(2);
    expect(router.push).not.toHaveBeenCalled();
  });

  it("opens the order page once the payment arrives", async () => {
    await renderCode("paid");

    await vi.advanceTimersByTimeAsync(PAYMENT_POLL_MS);

    expect(router.push).toHaveBeenCalledWith("/s/angkor/orders/order-1");
  });

  it("uses Khmer labels when the locale is km", async () => {
    await renderCode("pending", "km");

    expect(screen.getByRole("img", { name: "កូដ KHQR ដើម្បីបង់ $49.00" })).toBeInTheDocument();
  });
});
