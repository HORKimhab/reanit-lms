// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";

import { onApi, problem, requestTo } from "@/test/api";
import { signIn } from "@/test/session";
import { SALES_REPORT } from "@/test/stats";

import { getSalesReport } from "./sales";

vi.mock("next/headers", () => import("@/test/headers"));

/** The test report as the API sends it, its days as `YYYY-MM-DD`. */
const REPORT_JSON = {
  ...SALES_REPORT,
  range: { from: "2026-10-01", to: "2026-10-03" },
  daily: SALES_REPORT.daily.map((day) => ({ ...day, day: day.day.toISOString().slice(0, 10) })),
};

beforeEach(() => {
  signIn();
});

describe("getSalesReport", () => {
  it("asks for the range and reads its days back into Dates", async () => {
    onApi("GET /stats/sales", Response.json(REPORT_JSON));

    expect(await getSalesReport({ from: "2026-10-01", to: "2026-10-03" })).toEqual(SALES_REPORT);
    expect(new URL(requestTo("GET /stats/sales")?.url ?? "").search).toBe("?from=2026-10-01&to=2026-10-03");
  });

  it("returns null for a range the API refuses", async () => {
    onApi("GET /stats/sales", problem(400, "urn:reanit:problem:invalid-stats-range"));

    expect(await getSalesReport({ from: "2026-10-05", to: "2026-10-01" })).toBeNull();
  });
});
