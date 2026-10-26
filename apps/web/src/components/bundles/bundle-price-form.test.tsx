import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import type { CourseFormState } from "@/app/[locale]/dashboard/courses/actions";
import { renderWithIntl } from "@/test/render";

import { BundlePriceForm } from "./bundle-price-form";

describe("BundlePriceForm", () => {
  it("shows the current price in major units and saves a new one", async () => {
    const user = userEvent.setup();
    const action = vi.fn<(state: CourseFormState, formData: FormData) => Promise<CourseFormState>>().mockResolvedValue({ status: "saved", invalidFields: [] });
    renderWithIntl(<BundlePriceForm price={{ amount: 2_000_000, currency: "KHR", billing: { kind: "one_time" } }} action={action} />);

    const amount = await screen.findByRole("textbox", { name: "Amount" });
    expect(amount).toHaveValue("20000");
    expect(screen.getByRole("combobox", { name: "Currency" })).toHaveValue("KHR");
    await user.clear(amount);
    await user.type(amount, "25000");
    await user.click(screen.getByRole("button", { name: "Save price" }));

    expect(action.mock.calls[0]?.[1].get("amount")).toBe("25000");
    expect(await screen.findByText("Saved.")).toBeInTheDocument();
  });

  it("marks the amount the server rejected", async () => {
    const user = userEvent.setup();
    renderWithIntl(<BundlePriceForm price={null} action={vi.fn().mockResolvedValue({ status: "invalid", invalidFields: ["amount"] })} />);

    await user.type(await screen.findByRole("textbox", { name: "Amount" }), "0");
    await user.click(screen.getByRole("button", { name: "Save price" }));

    expect(await screen.findByText("Enter a price above zero in this currency.")).toBeInTheDocument();
    expect(screen.getByRole("combobox", { name: "Currency" })).toHaveValue("USD");
  });
});
