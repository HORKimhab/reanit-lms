import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";

import type { CourseFormState } from "@/app/[locale]/dashboard/courses/actions";
import { courseActionReturning, submitted } from "@/test/course-form";
import { renderWithIntl } from "@/test/render";

import { PriceForm } from "./price-form";

const SAVED: CourseFormState = { status: "saved", invalidFields: [] };

describe("PriceForm", () => {
  it("shows the current one-time price in major units and saves a new one", async () => {
    const user = userEvent.setup();
    const action = courseActionReturning(SAVED);
    renderWithIntl(<PriceForm price={{ amount: 2_000_000, currency: "KHR", billing: { kind: "one_time" } }} action={action} />);

    const amount = await screen.findByRole("textbox", { name: "Amount" });
    expect(amount).toHaveValue("20000");
    expect(screen.getByRole("combobox", { name: "Currency" })).toHaveValue("KHR");
    expect(screen.getByRole("radio", { name: "Once" })).toBeChecked();
    await user.clear(amount);
    await user.type(amount, "25000");
    await user.click(screen.getByRole("button", { name: "Save price" }));

    expect(submitted(action)).toEqual({ amount: "25000", currency: "KHR", billing: "one_time" });
    expect(await screen.findByText("Saved.")).toBeInTheDocument();
  });

  it("sets a yearly subscription", async () => {
    const user = userEvent.setup();
    const action = courseActionReturning(SAVED);
    renderWithIntl(<PriceForm price={null} action={action} />);

    await user.type(await screen.findByRole("textbox", { name: "Amount" }), "99");
    await user.click(screen.getByRole("radio", { name: "Subscription" }));
    await user.selectOptions(screen.getByRole("combobox", { name: "Billed every" }), "Year");
    await user.click(screen.getByRole("button", { name: "Save price" }));

    expect(screen.getByRole("textbox", { name: "Amount per period" })).toBeInTheDocument();
    expect(submitted(action)).toEqual({ amount: "99", currency: "USD", billing: "recurring", interval: "year" });
  });

  it("shows a payment plan's number of payments, and marks it when the server rejects it", async () => {
    const user = userEvent.setup();
    const action = courseActionReturning({ status: "invalid", invalidFields: ["installments"] });
    renderWithIntl(<PriceForm price={{ amount: 2500, currency: "USD", billing: { kind: "payment_plan", installments: 4 } }} action={action} />);

    const count = await screen.findByRole("spinbutton", { name: "Number of monthly payments" });
    expect(count).toHaveValue(4);
    await user.click(screen.getByRole("button", { name: "Save price" }));

    expect(submitted(action)).toMatchObject({ billing: "payment_plan", installments: "4" });
    expect(await screen.findByText("Choose between 2 and 24 payments.")).toBeInTheDocument();
  });

  it("marks the amount the server rejected", async () => {
    const user = userEvent.setup();
    renderWithIntl(<PriceForm price={null} action={courseActionReturning({ status: "invalid", invalidFields: ["amount"] })} />);

    await user.type(await screen.findByRole("textbox", { name: "Amount" }), "0");
    await user.click(screen.getByRole("button", { name: "Save price" }));

    expect(await screen.findByText("Enter a price above zero in this currency.")).toBeInTheDocument();
  });

  it("is written in Khmer for km", async () => {
    renderWithIntl(<PriceForm price={null} action={courseActionReturning(SAVED)} />, { locale: "km" });

    expect(await screen.findByRole("radio", { name: "ការជាវ" })).toBeInTheDocument();
  });
});
