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
