import type { Discount } from "@reanit/core/commerce";
import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import type { CouponCheck } from "@/app/[locale]/s/[school]/(student)/checkout/actions";
import { renderWithIntl } from "@/test/render";

import { CouponField } from "./coupon-field";

const DISCOUNT: Discount = { code: "SAVE20", amountOff: 980, total: 3920 };

/**
 * Renders the field inside a form, with a coupon check that answers as given.
 *
 * @param answer - What checking a code returns.
 * @param applied - The coupon already applied, if any.
 * @returns The user-event instance and the spies for the check, the change and the form's submit.
 */
async function setup(answer: CouponCheck = { status: "applied", discount: DISCOUNT }, applied: Discount | null = null) {
  const user = userEvent.setup();
  const checkCoupon = vi.fn<(code: string) => Promise<CouponCheck>>().mockResolvedValue(answer);
  const onChange = vi.fn();
  const onSubmit = vi.fn((event: SubmitEvent) => event.preventDefault());
  renderWithIntl(
    <form aria-label="Checkout" onSubmit={(event) => onSubmit(event.nativeEvent as SubmitEvent)}>
      <CouponField applied={applied} formatMoney={(amount) => `$${(amount / 100).toFixed(2)}`} checkCoupon={checkCoupon} onChange={onChange} />
    </form>,
  );
  await screen.findByRole("form");
  return { user, checkCoupon, onChange, onSubmit };
}

describe("CouponField", () => {
  it("applies the typed code when it can be used", async () => {
    const { user, checkCoupon, onChange } = await setup();

    await user.type(screen.getByRole("textbox", { name: "Coupon code" }), "save20");
    await user.click(screen.getByRole("button", { name: "Apply" }));

    expect(checkCoupon).toHaveBeenCalledWith("save20");
    expect(onChange).toHaveBeenCalledWith(DISCOUNT);
  });

  it("applies the code on Enter instead of submitting the payment", async () => {
    const { user, checkCoupon, onSubmit } = await setup();

    await user.type(screen.getByRole("textbox", { name: "Coupon code" }), "SAVE20{Enter}");

    expect(checkCoupon).toHaveBeenCalledWith("SAVE20");
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it("says a code cannot be used and applies nothing", async () => {
    const { user, onChange } = await setup({ status: "invalid" });

    await user.type(screen.getByRole("textbox", { name: "Coupon code" }), "OLD20");
    await user.click(screen.getByRole("button", { name: "Apply" }));

    expect(await screen.findByText("This coupon can't be used on this course.")).toBeInTheDocument();
    expect(screen.getByRole("textbox", { name: "Coupon code" })).toHaveAttribute("aria-invalid", "true");
    expect(onChange).not.toHaveBeenCalled();
  });

  it("does not ask about an empty code", async () => {
    const { user, checkCoupon } = await setup();

    await user.click(screen.getByRole("button", { name: "Apply" }));

    expect(checkCoupon).not.toHaveBeenCalled();
  });

  it("shows the applied coupon, posts its code with the form, and removes it", async () => {
    const { user, onChange } = await setup(undefined, DISCOUNT);

    expect(screen.getByRole("status")).toHaveTextContent("SAVE20 applied: $9.80 off");
    expect(new FormData(screen.getByRole("form") as HTMLFormElement).get("couponCode")).toBe("SAVE20");
    await user.click(screen.getByRole("button", { name: "Remove coupon" }));

    expect(onChange).toHaveBeenCalledWith(null);
  });
});
