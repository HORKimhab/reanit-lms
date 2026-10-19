import { CouponCodeTakenError, CouponNotFoundError } from "@reanit/core/commerce";
import { describe, expect, it } from "vitest";

import { TEST_SCHOOL, useStaffApp } from "../test/session";

const COUPON_ID = "5a4b3c2d-1e0f-4a9b-8c7d-6e5f4a3b2c1d";
const COUPON = { code: "SAVE20", kind: "percent", percentOff: 20, expiresAt: null, maxRedemptions: null } as const;
const staff = useStaffApp();

/** Makes the signed-in staff member an owner, who manages coupons. */
function asOwner() {
  staff.clients.schools.getStaffSchool.mockResolvedValue({ school: TEST_SCHOOL, role: "owner" });
}

describe("POST /coupons", () => {
  it("creates the coupon in the caller's school, with its expiry as an ISO date", async () => {
    asOwner();
    const expiresAt = new Date("2026-12-31T00:00:00Z");
    staff.clients.commerce.createCoupon.mockResolvedValue({ ...COUPON, id: COUPON_ID, expiresAt, redemptions: 0 });

    const response = await staff.app.inject({
      method: "POST",
      url: "/coupons",
      headers: staff.headers,
      payload: { coupon: { ...COUPON, code: "save20", expiresAt: expiresAt.toISOString() } },
    });

    expect(response.statusCode).toBe(201);
    expect(response.json()).toEqual({ coupon: { ...COUPON, id: COUPON_ID, expiresAt: "2026-12-31T00:00:00.000Z", redemptions: 0 } });
    expect(staff.clients.commerceFor).toHaveBeenCalledWith(TEST_SCHOOL.id);
    expect(staff.clients.commerce.createCoupon).toHaveBeenCalledWith({ ...COUPON, expiresAt });
  });

  it("refuses an instructor: coupons are for owners and admins", async () => {
    const response = await staff.app.inject({ method: "POST", url: "/coupons", headers: staff.headers, payload: { coupon: COUPON } });

    expect(response.statusCode).toBe(403);
    expect(staff.clients.commerce.createCoupon).not.toHaveBeenCalled();
  });

  it.each([
    ["100 percent off", { ...COUPON, percentOff: 100 }],
    ["a fixed coupon without a currency", { code: "TEN", kind: "fixed", amountOff: 1000 }],
  ])("answers 400 for %s", async (_case, coupon) => {
    asOwner();

    const response = await staff.app.inject({ method: "POST", url: "/coupons", headers: staff.headers, payload: { coupon } });

    expect(response.statusCode).toBe(400);
  });

  it("answers 409 coupon-code-taken for a code the school already has", async () => {
    asOwner();
    staff.clients.commerce.createCoupon.mockRejectedValue(new CouponCodeTakenError());

    const response = await staff.app.inject({ method: "POST", url: "/coupons", headers: staff.headers, payload: { coupon: COUPON } });

    expect(response.statusCode).toBe(409);
    expect(response.json().type).toBe("urn:reanit:problem:coupon-code-taken");
  });
});

describe("GET /coupons", () => {
  it("lists the school's coupons with their uses", async () => {
    asOwner();
    staff.clients.commerce.listCoupons.mockResolvedValue([{ ...COUPON, id: COUPON_ID, redemptions: 3 }]);

    const response = await staff.app.inject({ method: "GET", url: "/coupons", headers: staff.headers });

    expect(response.json()).toEqual({ coupons: [{ ...COUPON, id: COUPON_ID, redemptions: 3 }] });
  });
});

describe("DELETE /coupons/:id", () => {
  it("deletes the coupon and answers 204", async () => {
    asOwner();
    staff.clients.commerce.deleteCoupon.mockResolvedValue(undefined);

    const response = await staff.app.inject({ method: "DELETE", url: `/coupons/${COUPON_ID}`, headers: staff.headers });

    expect(response.statusCode).toBe(204);
    expect(staff.clients.commerce.deleteCoupon).toHaveBeenCalledWith(COUPON_ID);
  });

  it("answers 404 for another school's or a missing coupon", async () => {
    asOwner();
    staff.clients.commerce.deleteCoupon.mockRejectedValue(new CouponNotFoundError());

    const response = await staff.app.inject({ method: "DELETE", url: `/coupons/${COUPON_ID}`, headers: staff.headers });

    expect(response.statusCode).toBe(404);
  });
});
