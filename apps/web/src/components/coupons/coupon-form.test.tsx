import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import type { CouponFormState } from "@/app/[locale]/dashboard/coupons/actions";
import { renderWithIntl } from "@/test/render";

import { CouponForm } from "./coupon-form";

/**
 * Renders the form with a create action that answers as given.
 *
 * @param answer - What creating returns.
 * @param locale - UI locale.
 * @returns The user-event instance and the action spy.
 */
async function setup(answer: CouponFormState = { status: "created", invalidFields: [] }, locale: "en" | "km" = "en") {
  const user = userEvent.setup();
  const action = vi.fn<(state: CouponFormState, formData: FormData) => Promise<CouponFormState>>().mockResolvedValue(answer);
  renderWithIntl(<CouponForm action={action} />, { locale });
  await screen.findAllByRole("radio");
  return { user, action };
}

/**
 * Reads the form data the create action received.
 *
 * @param action - The action spy.
 * @returns The submitted fields.
 */
function submitted(action: ReturnType<typeof vi.fn>) {
  return Object.fromEntries((action.mock.calls[0]?.[1] as FormData).entries());
}

describe("CouponForm", () => {
  it("creates a percent coupon and says so", async () => {
    const { user, action } = await setup();

    await user.type(screen.getByRole("textbox", { name: "Code" }), "launch");
    await user.type(screen.getByRole("spinbutton", { name: "Percent" }), "20");
    await user.click(screen.getByRole("button", { name: "Create coupon" }));

    expect(await screen.findByText("Coupon created")).toBeInTheDocument();
    expect(submitted(action)).toMatchObject({ code: "launch", kind: "percent", percentOff: "20", expiresAt: "", maxRedemptions: "" });
  });

  it("asks for an amount and currency instead of a percent for an amount-off coupon", async () => {
    const { user, action } = await setup();

    await user.click(screen.getByRole("radio", { name: "Amount off" }));
    expect(screen.queryByRole("spinbutton", { name: "Percent" })).not.toBeInTheDocument();
    await user.type(screen.getByRole("textbox", { name: "Code" }), "RIEL5K");
    await user.type(screen.getByRole("textbox", { name: "Amount" }), "5000");
    await user.selectOptions(screen.getByRole("combobox", { name: "Currency" }), "KHR");
    await user.click(screen.getByRole("button", { name: "Create coupon" }));

    expect(submitted(action)).toMatchObject({ kind: "fixed", amountOff: "5000", currency: "KHR" });
  });

  it("sends the last day as the end of that day in the creator's time zone", async () => {
    const { user, action } = await setup();

    await user.type(screen.getByRole("textbox", { name: "Code" }), "XMAS");
    await user.type(screen.getByRole("spinbutton", { name: "Percent" }), "10");
    await user.type(screen.getByLabelText("Last day (optional)"), "2026-12-31");
    await user.click(screen.getByRole("button", { name: "Create coupon" }));

    expect(submitted(action).expiresAt).toBe(new Date(2026, 11, 31, 23, 59, 59, 999).toISOString());
  });

  it("marks the fields the server rejected", async () => {
    const { user } = await setup({ status: "invalid", invalidFields: ["code", "percentOff"] });

    await user.type(screen.getByRole("textbox", { name: "Code" }), "TAKEN");
    await user.type(screen.getByRole("spinbutton", { name: "Percent" }), "20");
    await user.click(screen.getByRole("button", { name: "Create coupon" }));

    expect(await screen.findByText("Use 3 to 32 letters, digits, - or _ that no other coupon of yours uses.")).toBeInTheDocument();
    expect(screen.getByRole("textbox", { name: "Code" })).toHaveAttribute("aria-invalid", "true");
    expect(screen.getByRole("spinbutton", { name: "Percent" })).toHaveAttribute("aria-invalid", "true");
  });

  it("uses Khmer labels when the locale is km", async () => {
    await setup(undefined, "km");

    expect(screen.getByRole("button", { name: "បង្កើតគូប៉ុង" })).toBeInTheDocument();
  });
});
