import { screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { renderWithIntl } from "@/test/render";

import { PlanPaymentNotice } from "./plan-payment-notice";

describe("PlanPaymentNotice", () => {
  it.each([
    ["paid", "Payment received. Your plan is updated."],
    ["pending", "Waiting for your plan payment…"],
    ["failed", "Your plan payment didn't go through."],
  ] as const)("says a %s payment's outcome", async (status, message) => {
    renderWithIntl(<PlanPaymentNotice status={status} />);

    expect(await screen.findByRole("status")).toHaveTextContent(message);
  });
});
