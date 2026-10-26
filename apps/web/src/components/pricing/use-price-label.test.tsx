import type { PriceInput } from "@reanit/core/commerce";
import { screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { renderWithIntl } from "@/test/render";

import { usePriceLabel } from "./use-price-label";

/**
 * Shows a price's label, as a component using the hook would.
 *
 * @param props - Component props.
 * @param props.price - The price.
 * @returns The label.
 */
function Label({ price }: { price: PriceInput }) {
  return <p>{usePriceLabel()(price)}</p>;
}

describe("usePriceLabel", () => {
  it.each([
    [{ kind: "one_time" }, "$49.00"],
    [{ kind: "recurring", interval: "month" }, "$49.00 / month"],
    [{ kind: "recurring", interval: "year" }, "$49.00 / year"],
    [{ kind: "payment_plan", installments: 3 }, "3 payments of $49.00"],
  ] as const)("labels %j as %s", async (billing, label) => {
    renderWithIntl(<Label price={{ amount: 4900, currency: "USD", billing }} />);

    expect(await screen.findByText(label)).toBeInTheDocument();
  });

  it("is written in Khmer for km", async () => {
    renderWithIntl(<Label price={{ amount: 4900, currency: "USD", billing: { kind: "recurring", interval: "month" } }} />, { locale: "km" });

    expect(await screen.findByText(/ខែ/)).toBeInTheDocument();
  });
});
