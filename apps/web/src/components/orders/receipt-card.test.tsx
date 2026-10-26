import { screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { ORDER } from "@/test/orders";
import { renderWithIntl } from "@/test/render";

import { ReceiptCard } from "./receipt-card";

describe("ReceiptCard", () => {
  it("shows the order's reference, status, payment, coupon and what it bought", async () => {
    renderWithIntl(<ReceiptCard order={ORDER} />);

    const receipt = await screen.findByRole("article", { name: "Order 6F1C1F3E" });
    expect(within(receipt).getByText("Paid", { selector: "span" })).toBeInTheDocument();
    expect(within(receipt).getByText("Card")).toBeInTheDocument();
    expect(within(receipt).getByText("SAVE20")).toBeInTheDocument();
    expect(within(receipt).getByRole("rowheader", { name: "Brand Design Basics" })).toBeInTheDocument();
    expect(within(receipt).getByRole("row", { name: "Total $39.20" })).toBeInTheDocument();
    expect(within(receipt).queryByText("Refunded")).not.toBeInTheDocument();
  });

  it("shows when an order was refunded, and that the school paid it back directly", async () => {
    renderWithIntl(<ReceiptCard order={{ ...ORDER, status: "refunded", method: "bakong_khqr", refundedAt: new Date("2026-10-21T09:00:00Z"), isRefundedByHand: true }} />);

    expect(await screen.findByText("Refunded", { selector: "dt" })).toBeInTheDocument();
    expect(screen.getByText("Refunded", { selector: "span" })).toBeInTheDocument();
    expect(screen.getByText("The school refunded this order directly.")).toBeInTheDocument();
    expect(screen.getByText("Bakong KHQR")).toBeInTheDocument();
  });

  it("is written in Khmer for km", async () => {
    renderWithIntl(<ReceiptCard order={ORDER} />, { locale: "km" });

    expect(await screen.findByRole("article", { name: "ការបញ្ជាទិញ 6F1C1F3E" })).toBeInTheDocument();
    expect(screen.getByText("បានបង់", { selector: "span" })).toBeInTheDocument();
  });
});
