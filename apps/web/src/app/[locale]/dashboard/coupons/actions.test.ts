// @vitest-environment node
import { revalidatePath } from "next/cache";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { onApi, problem, requestTo } from "@/test/api";
import { formData as form } from "@/test/form";
import { NotFoundError } from "@/test/navigation";
import { signIn } from "@/test/session";

import { createCoupon, deleteCoupon, type CouponFormState } from "./actions";

vi.mock("next/headers", () => import("@/test/headers"));
// Cache revalidation needs a running Next server; it is a boundary, so record calls instead.
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

const IDLE: CouponFormState = { status: "idle", invalidFields: [] };
const ROUTE = "POST /coupons";
const COUPON_ID = "6f1c1f3e-1c5a-4a8e-9a39-2c1f1d9e0a40";
const CREATED = Response.json({ coupon: {} }, { status: 201 });

beforeEach(() => {
  signIn();
});

describe("createCoupon", () => {
  it("creates a percent coupon with the code in upper case and refreshes the list", async () => {
    onApi(ROUTE, CREATED);

    expect(await createCoupon(IDLE, form({ code: " launch ", kind: "percent", percentOff: "20", expiresAt: "", maxRedemptions: "" }))).toEqual({
      status: "created",
      invalidFields: [],
    });
    expect(await requestTo(ROUTE)?.json()).toEqual({
      coupon: { code: "LAUNCH", kind: "percent", percentOff: 20, expiresAt: null, maxRedemptions: null },
    });
    expect(revalidatePath).toHaveBeenCalledWith("/dashboard/coupons");
  });

  it("sends a fixed amount typed in riel as minor units, with its last moment and usage limit", async () => {
    onApi(ROUTE, CREATED);

    await createCoupon(
      IDLE,
      form({ code: "RIEL5K", kind: "fixed", amountOff: "5,000", currency: "KHR", expiresAt: "2026-12-31T16:59:59.999Z", maxRedemptions: "50" }),
    );

    expect(await requestTo(ROUTE)?.json()).toEqual({
      coupon: { code: "RIEL5K", kind: "fixed", amountOff: 500_000, currency: "KHR", expiresAt: "2026-12-31T16:59:59.999Z", maxRedemptions: 50 },
    });
  });

  it.each([
    ["a code with spaces", { code: "SAVE 20", kind: "percent", percentOff: "20" }, ["code"]],
    ["100 percent off", { code: "FREE", kind: "percent", percentOff: "100" }, ["percentOff"]],
    ["an empty percent", { code: "SAVE", kind: "percent", percentOff: "" }, ["percentOff"]],
    ["cents on a riel amount", { code: "RIEL", kind: "fixed", amountOff: "10.50", currency: "KHR" }, ["amountOff"]],
    ["an unknown currency", { code: "EURO", kind: "fixed", amountOff: "10", currency: "EUR" }, ["amountOff"]],
    ["a usage limit of zero", { code: "ZERO", kind: "percent", percentOff: "20", maxRedemptions: "0" }, ["maxRedemptions"]],
    ["a last day that is not a date", { code: "DAY", kind: "percent", percentOff: "20", expiresAt: "tomorrow" }, ["expiresAt"]],
  ])("rejects %s without calling the API", async (_case, fields, invalidFields) => {
    expect(await createCoupon(IDLE, form(fields))).toEqual({ status: "invalid", invalidFields });
    expect(requestTo(ROUTE)).toBeUndefined();
  });

  it("blames the code when the school already has it", async () => {
    onApi(ROUTE, problem(409, "urn:reanit:problem:coupon-code-taken"));

    expect(await createCoupon(IDLE, form({ code: "LAUNCH", kind: "percent", percentOff: "20" }))).toEqual({ status: "invalid", invalidFields: ["code"] });
    expect(revalidatePath).not.toHaveBeenCalled();
  });
});

describe("deleteCoupon", () => {
  it("deletes the coupon and refreshes the list", async () => {
    onApi(`DELETE /coupons/${COUPON_ID}`, new Response(null, { status: 204 }));

    await deleteCoupon(COUPON_ID);

    expect(requestTo(`DELETE /coupons/${COUPON_ID}`)).toBeDefined();
    expect(revalidatePath).toHaveBeenCalledWith("/dashboard/coupons");
  });

  it("404s on a coupon that is already gone", async () => {
    onApi(`DELETE /coupons/${COUPON_ID}`, problem(404));

    await expect(deleteCoupon(COUPON_ID)).rejects.toBeInstanceOf(NotFoundError);
  });
});
