import { screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { renderWithIntl } from "@/test/render";
import type { MySubscription } from "@/server/commerce/subscriptions";

import { SubscriptionList } from "./subscription-list";

const MONTHLY: MySubscription = {
  id: "sub-1",
  status: "active",
  title: "Design Club",
  price: { amount: 1500, currency: "USD", billing: { kind: "recurring", interval: "month" } },
  methods: ["offline_qr"],
  paidPeriods: 2,
  currentPeriodEnd: new Date("2026-11-01T09:00:00Z"),
};
const PLAN: MySubscription = { ...MONTHLY, id: "sub-2", title: "Pro Course", status: "lapsed", price: { amount: 2500, currency: "USD", billing: { kind: "payment_plan", installments: 4 } } };
const PAID_OFF: MySubscription = { ...PLAN, id: "sub-3", title: "Old Course", status: "completed", paidPeriods: 4 };

/**
 * Links a subscription's renewal page.
 *
 * @param id - The subscription.
 * @returns The path.
 */
function renewHref(id: string) {
  return `/s/angkor/renew/${id}`;
}

describe("SubscriptionList", () => {
  it("shows each subscription's price, status and how far it is paid, with a link to pay the next period", async () => {
    renderWithIntl(<SubscriptionList subscriptions={[MONTHLY, PLAN, PAID_OFF]} renewHref={renewHref} />);

    const [monthly, plan, paidOff] = within(await screen.findByRole("region", { name: "Subscriptions and payment plans" })).getAllByRole("listitem");
    expect(monthly).toHaveTextContent("Design Club");
    expect(monthly).toHaveTextContent("$15.00 / month");
    expect(monthly).toHaveTextContent("Active");
    expect(monthly).toHaveTextContent("Paid until Nov 1, 2026");
    expect(within(monthly!).getByRole("link", { name: "Pay next period" })).toHaveAttribute("href", "/s/angkor/renew/sub-1"); // the list has three items
    expect(plan).toHaveTextContent("Lapsed");
    expect(plan).toHaveTextContent("2 of 4 payments made");
    expect(within(plan!).getByRole("link", { name: "Pay next instalment" })).toBeInTheDocument(); // and the plan's
    expect(paidOff).toHaveTextContent("Paid off");
    expect(within(paidOff!).queryByRole("link")).not.toBeInTheDocument(); // and the paid-off plan's
  });

  it("is written in Khmer for km", async () => {
    renderWithIntl(<SubscriptionList subscriptions={[MONTHLY]} renewHref={renewHref} />, { locale: "km" });

    expect(await screen.findByRole("link", { name: "បង់ដំណាក់កាលបន្ទាប់" })).toBeInTheDocument();
  });
});
