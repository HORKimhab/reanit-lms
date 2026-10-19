import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { CheckoutState, CouponCheck } from "@/app/[locale]/s/[school]/(student)/checkout/actions";
import { renderWithIntl } from "@/test/render";

import { CheckoutForm } from "./checkout-form";

const PRICE = { amount: 4900, currency: "USD" as const };

/**
 * Renders the form with a checkout action that answers as given.
 *
 * @param answer - What the checkout action returns.
 * @param methods - The methods offered.
 * @param coupon - What checking a coupon code returns.
 * @returns The user-event instance and the action spy.
 */
async function setup(
  answer: CheckoutState,
  methods: ("stripe" | "aba_payway" | "bakong_khqr")[] = ["aba_payway", "bakong_khqr", "stripe"],
  coupon: CouponCheck = { status: "invalid" },
) {
  const user = userEvent.setup();
  const action = vi.fn<(previous: CheckoutState, formData: FormData) => Promise<CheckoutState>>().mockResolvedValue(answer);
  renderWithIntl(
    <CheckoutForm
      methods={methods}
      price={PRICE}
      courseHref="/s/angkor/learn/brand"
      action={action}
      ordersBase="/s/angkor/orders"
      checkStatus={vi.fn().mockResolvedValue("pending")}
      checkCoupon={vi.fn().mockResolvedValue(coupon)}
    />,
  );
  await screen.findByText(methods.length > 0 ? "How do you want to pay?" : "No payment method takes this course's currency yet.");
  return { user, action };
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe("CheckoutForm", () => {
  it("offers the course's methods, the first one picked, and pays with the chosen one", async () => {
    const { user, action } = await setup({ status: "unavailable" });

    expect(screen.getAllByRole("radio").map((radio) => radio.getAttribute("value"))).toEqual(["aba_payway", "bakong_khqr", "stripe"]);
    expect(screen.getByRole("radio", { name: "ABA PayWay" })).toBeChecked();
    await user.click(screen.getByRole("radio", { name: "Card" }));
    await user.click(screen.getByRole("button", { name: "Pay $49.00" }));

    expect(action.mock.calls[0]?.[1].get("method")).toBe("stripe");
  });

  it("charges the discounted total once a coupon is applied, and pays with its code", async () => {
    const { user, action } = await setup({ status: "unavailable" }, ["stripe"], { status: "applied", discount: { code: "SAVE20", amountOff: 980, total: 3920 } });

    await user.type(screen.getByRole("textbox", { name: "Coupon code" }), "save20");
    await user.click(screen.getByRole("button", { name: "Apply" }));
    await user.click(await screen.findByRole("button", { name: "Pay $39.20" }));

    expect(action.mock.calls[0]?.[1].get("couponCode")).toBe("SAVE20");
  });

  it("says the coupon stopped working when paying is refused for it", async () => {
    const { user } = await setup({ status: "invalidCoupon" });

    await user.click(screen.getByRole("button", { name: "Pay $49.00" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("This coupon can't be used on this course.");
  });

  it("asks for another method when the chosen one cannot take the payment", async () => {
    const { user } = await setup({ status: "unavailable" });

    await user.click(screen.getByRole("button", { name: "Pay $49.00" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("This payment method can't take this payment.");
  });

  it("shows the KHQR code to scan after choosing Bakong", async () => {
    const { user } = await setup({ status: "qr", qr: "00020101021229", expiresAt: "2026-10-19T01:15:00.000Z", orderId: "order-1" });

    await user.click(screen.getByRole("button", { name: "Pay $49.00" }));

    expect(await screen.findByRole("img", { name: "KHQR code to pay $49.00" })).toBeInTheDocument();
  });

  it("hands over to the gateway's form after choosing PayWay", async () => {
    vi.spyOn(HTMLFormElement.prototype, "submit").mockImplementation(() => {});
    const { user } = await setup({ status: "form", action: "https://payway.test/purchase", fields: { tran_id: "t1" } });

    await user.click(screen.getByRole("button", { name: "Pay $49.00" }));

    expect(await screen.findByRole("button", { name: "Continue to payment" })).toBeInTheDocument();
  });

  it("sends a student who already has the course to it", async () => {
    const { user } = await setup({ status: "enrolled" });

    await user.click(screen.getByRole("button", { name: "Pay $49.00" }));

    expect(await screen.findByRole("link", { name: "Go to the course" })).toHaveAttribute("href", "/s/angkor/learn/brand");
  });

  it("says so when no method takes the course's currency", async () => {
    await setup({ status: "idle" }, []);

    expect(await screen.findByText("No payment method takes this course's currency yet.")).toBeInTheDocument();
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });
});
