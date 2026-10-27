import { PLAN_TERMS } from "@reanit/core/schools";
import { screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { renderWithIntl } from "@/test/render";

import { CurrentPlan } from "./current-plan";

describe("CurrentPlan", () => {
  it("shows a paid plan, its fee and until when it is paid", async () => {
    renderWithIntl(<CurrentPlan plan={{ plan: "pro", terms: PLAN_TERMS.pro, paid: { plan: "pro", interval: "year", periodEnd: new Date("2027-10-27T12:00:00Z") } }} />);

    expect(await screen.findByRole("heading", { name: "You're on Pro" })).toBeInTheDocument();
    expect(screen.getByText("The platform takes 5% of each sale.")).toBeInTheDocument();
    expect(screen.getByText("Paid until Oct 27, 2027, billed every year.")).toBeInTheDocument();
  });

  it("says a paid plan ran out and the school is back on Free", async () => {
    renderWithIntl(<CurrentPlan plan={{ plan: "free", terms: PLAN_TERMS.free, paid: { plan: "business", interval: "month", periodEnd: new Date("2026-09-01T00:00:00Z") } }} />);

    expect(await screen.findByRole("heading", { name: "You're on Free" })).toBeInTheDocument();
    expect(screen.getByRole("alert")).toHaveTextContent("Your Business plan ran out on Sep 1, 2026.");
  });

  it("shows only the plan and fee for a school that never paid", async () => {
    renderWithIntl(<CurrentPlan plan={{ plan: "free", terms: PLAN_TERMS.free, paid: null }} />);

    expect(await screen.findByText("The platform takes 10% of each sale.")).toBeInTheDocument();
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });
});
