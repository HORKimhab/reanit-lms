// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";

import { onApi } from "@/test/api";
import { PAYOUTS_JSON, SCHOOL_PAYOUTS } from "@/test/payouts";
import { signIn } from "@/test/session";

import { getSchoolPayouts } from "./payouts";

vi.mock("next/headers", () => import("@/test/headers"));

beforeEach(() => {
  signIn();
});

describe("getSchoolPayouts", () => {
  it("returns the school's payouts with the next payout and payout dates as dates", async () => {
    onApi("GET /schools/current/payouts", Response.json(PAYOUTS_JSON));

    expect(await getSchoolPayouts()).toEqual(SCHOOL_PAYOUTS);
  });
});
