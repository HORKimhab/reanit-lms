import { NotSchoolStaffError } from "@reanit/core/schools";
import { describe, expect, it } from "vitest";

import { TEST_SCHOOL, useStaffApp } from "../test/session";

const staff = useStaffApp();

const SOKHA = {
  id: "8d7c6b5a-4f3e-4d2c-9b1a-0f9e8d7c6b5a",
  name: "Sokha Chan",
  email: "sokha@example.com",
  courses: 2,
  completedCourses: 1,
};

describe("GET /students", () => {
  it("lists the caller's school's students with the parsed search and page", async () => {
    staff.clients.students.searchStudents.mockResolvedValue({
      students: [{ ...SOKHA, joinedAt: new Date("2026-03-14T00:00:00Z") }],
      total: 51,
      page: 2,
      pageSize: 50,
    });

    const response = await staff.app.inject({ method: "GET", url: "/students?q=%20sokha%20&page=2", headers: staff.headers });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({ students: [{ ...SOKHA, joinedAt: "2026-03-14T00:00:00.000Z" }], total: 51, page: 2, pageSize: 50 });
    expect(staff.clients.studentsFor).toHaveBeenCalledWith(TEST_SCHOOL.id);
    expect(staff.clients.students.searchStudents).toHaveBeenCalledWith({ q: "sokha", page: 2 });
  });

  it("answers 400 for a page below 1", async () => {
    const response = await staff.app.inject({ method: "GET", url: "/students?page=0", headers: staff.headers });

    expect(response.statusCode).toBe(400);
    expect(staff.clients.students.searchStudents).not.toHaveBeenCalled();
  });

  it("answers 403 to someone who runs no school", async () => {
    staff.clients.schools.getStaffSchool.mockRejectedValue(new NotSchoolStaffError());

    expect((await staff.app.inject({ method: "GET", url: "/students", headers: staff.headers })).statusCode).toBe(403);
    expect(staff.clients.students.searchStudents).not.toHaveBeenCalled();
  });

  it("answers 401 when signed out", async () => {
    expect((await staff.app.inject({ method: "GET", url: "/students" })).statusCode).toBe(401);
  });
});
