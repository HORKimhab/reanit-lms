import { InvalidStatsRangeError } from "@reanit/core/analytics";
import { NotSchoolStaffError } from "@reanit/core/schools";
import { describe, expect, it } from "vitest";

import { TEST_SCHOOL, useStaffApp } from "../test/session";

const staff = useStaffApp();

describe("GET /stats/courses", () => {
  it("lists the caller's school's course stats", async () => {
    const courses = [
      {
        courseId: "8d7c6b5a-4f3e-4d2c-9b1a-0f9e8d7c6b5a",
        title: "Brand Design Basics",
        slug: "brand",
        students: 3,
        completions: 1,
        revenue: [{ currency: "KHR", amount: 3_000_000_000 }],
      },
    ];
    staff.clients.analytics.getCourseStats.mockResolvedValue(courses);

    const response = await staff.app.inject({ method: "GET", url: "/stats/courses", headers: staff.headers });

    expect(response.json()).toEqual({ courses });
    expect(staff.clients.analyticsFor).toHaveBeenCalledWith(TEST_SCHOOL.id);
  });

  it("answers 403 to someone who runs no school", async () => {
    staff.clients.schools.getStaffSchool.mockRejectedValue(new NotSchoolStaffError());

    expect((await staff.app.inject({ method: "GET", url: "/stats/courses", headers: staff.headers })).statusCode).toBe(403);
    expect(staff.clients.analytics.getCourseStats).not.toHaveBeenCalled();
  });
});

describe("GET /stats/sales", () => {
  const DAY = new Date("2026-10-01T00:00:00Z");
  const REPORT = {
    range: { from: DAY, to: DAY },
    daily: [{ day: DAY, sales: 1, revenue: [{ currency: "USD", amount: 4900 }] }],
    byCourse: [{ courseId: "8d7c6b5a-4f3e-4d2c-9b1a-0f9e8d7c6b5a", title: "Brand", slug: "brand", sales: 1, revenue: [{ currency: "USD", amount: 4900 }] }],
    totals: { sales: 1, revenue: [{ currency: "USD", amount: 4900 }] },
    refunds: [],
    funnel: { enrolled: 1, started: 0, halfway: 0, completed: 0 },
  };

  it("reports the range asked for, with days as YYYY-MM-DD", async () => {
    staff.clients.analytics.getSalesReport.mockResolvedValue(REPORT);

    const response = await staff.app.inject({ method: "GET", url: "/stats/sales?from=2026-10-01&to=2026-10-01", headers: staff.headers });

    expect(response.json()).toEqual({ ...REPORT, range: { from: "2026-10-01", to: "2026-10-01" }, daily: [{ ...REPORT.daily[0], day: "2026-10-01" }] });
    expect(staff.clients.analytics.getSalesReport).toHaveBeenCalledWith({ from: "2026-10-01", to: "2026-10-01" });
  });

  it("answers 400 for a day that is not YYYY-MM-DD", async () => {
    const response = await staff.app.inject({ method: "GET", url: "/stats/sales?from=yesterday", headers: staff.headers });

    expect(response.statusCode).toBe(400);
    expect(staff.clients.analytics.getSalesReport).not.toHaveBeenCalled();
  });

  it("answers 400 invalid-stats-range for a range the report refuses", async () => {
    staff.clients.analytics.getSalesReport.mockRejectedValue(new InvalidStatsRangeError());

    const response = await staff.app.inject({ method: "GET", url: "/stats/sales?from=2026-10-05&to=2026-10-01", headers: staff.headers });

    expect(response.json()).toMatchObject({ status: 400, type: "urn:reanit:problem:invalid-stats-range" });
  });
});
