// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";

import { onApi, problem } from "@/test/api";
import { RedirectError } from "@/test/navigation";
import { signIn } from "@/test/session";

import { listCoupons } from "./coupons";

vi.mock("next/headers", () => import("@/test/headers"));

const COUPON_ID = "6f1c1f3e-1c5a-4a8e-9a39-2c1f1d9e0a40";

beforeEach(() => {
  signIn();
});

describe("listCoupons", () => {
  it("returns the school's coupons with their expiry as a Date", async () => {
    const coupon = { id: COUPON_ID, code: "SAVE20", kind: "percent", percentOff: 20, maxRedemptions: null, redemptions: 2 };
    onApi("GET /coupons", Response.json({ coupons: [{ ...coupon, expiresAt: "2026-12-31T16:59:59.999Z" }, { ...coupon, expiresAt: null }] }));

    expect(await listCoupons()).toEqual([
      { ...coupon, expiresAt: new Date("2026-12-31T16:59:59.999Z") },
      { ...coupon, expiresAt: null },
    ]);
  });

  it("sends an instructor's or stranger's request to onboarding", async () => {
    onApi("GET /coupons", problem(403));

    await expect(listCoupons()).rejects.toEqual(new RedirectError("/onboarding"));
  });
});
