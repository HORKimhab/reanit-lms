// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";

import { DUE_PAYOUT, SCHOOL_PAGE, SCHOOLS_JSON, SUBMITTED_PLAN_PAYMENT } from "@/test/admin";
import { onApi, problem, requestTo } from "@/test/api";
import { NotFoundError, RedirectError } from "@/test/navigation";
import { signIn } from "@/test/session";

import { getDuePayouts, getPlatformSchools, getSubmittedPlanPayments, schoolsQueryFrom } from "./console";

vi.mock("next/headers", () => import("@/test/headers"));

beforeEach(() => {
  signIn();
});

describe("schoolsQueryFrom", () => {
  it("reads the search and page, and falls back to the first page of everyone", () => {
    expect(schoolsQueryFrom({ q: " angkor ", page: "2" })).toEqual({ q: "angkor", page: 2 });
    expect(schoolsQueryFrom({ page: "nope" })).toEqual({ page: 1 });
  });
});

describe("getPlatformSchools", () => {
  it("returns the page with its dates as dates, sending only a search that was given", async () => {
    onApi("GET /admin/schools", Response.json(SCHOOLS_JSON));

    expect(await getPlatformSchools({ page: 1 })).toEqual(SCHOOL_PAGE);
    expect(new URL(requestTo("GET /admin/schools")!.url).search).toBe("?page=1");
  });

  it("is not found for anyone but a platform admin, and sends a signed-out visitor to log in", async () => {
    onApi("GET /admin/schools", problem(403));
    await expect(getPlatformSchools({ page: 1 })).rejects.toThrow(NotFoundError);

    onApi("GET /admin/schools", problem(401));
    await expect(getPlatformSchools({ page: 1 })).rejects.toThrow(new RedirectError("/login?next=%2Fadmin%2Fschools"));
  });
});

describe("getSubmittedPlanPayments and getDuePayouts", () => {
  it("returns the payments waiting with dates as dates, and the payouts due", async () => {
    onApi("GET /admin/plan-payments", Response.json({ payments: [{ ...SUBMITTED_PLAN_PAYMENT, submittedAt: "2026-10-27T09:00:00.000Z" }] }));
    onApi("GET /admin/payouts/due", Response.json({ payouts: [DUE_PAYOUT] }));

    expect(await getSubmittedPlanPayments()).toEqual([SUBMITTED_PLAN_PAYMENT]);
    expect(await getDuePayouts()).toEqual([DUE_PAYOUT]);
  });
});
