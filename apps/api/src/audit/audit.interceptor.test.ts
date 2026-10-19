import { Logger } from "@nestjs/common";
import { CourseNotFoundError, type Course } from "@reanit/core/catalog";
import { describe, expect, it, vi } from "vitest";

import { TEST_SCHOOL, TEST_USER, useStaffApp } from "../test/session";

const COURSE: Course = { id: "8d7c6b5a-4f3e-4d2c-9b1a-0f9e8d7c6b5a", title: "Intro", slug: "intro", description: null, status: "draft" };

const staff = useStaffApp();

/**
 * Renames the test course through the API.
 *
 * @returns The response.
 */
function renameCourse() {
  return staff.app.inject({ method: "PATCH", url: `/courses/${COURSE.id}`, headers: staff.headers, payload: { title: "Renamed" } });
}

describe("audit log", () => {
  it("records who changed what, in which request, once the change succeeded", async () => {
    staff.clients.catalog.updateCourse.mockResolvedValue({ ...COURSE, title: "Renamed" });

    const response = await renameCourse();

    expect(response.statusCode).toBe(200);
    expect(staff.clients.auditFor).toHaveBeenCalledWith(TEST_SCHOOL.id);
    expect(staff.clients.audit.record).toHaveBeenCalledWith({
      actorId: TEST_USER.id,
      action: "course.update",
      targetId: COURSE.id,
      requestId: response.headers["x-request-id"],
    });
  });

  it("targets a new course by the id the create returned", async () => {
    staff.clients.catalog.createCourse.mockResolvedValue(COURSE);

    await staff.app.inject({ method: "POST", url: "/courses", headers: staff.headers, payload: { title: "Intro" } });

    expect(staff.clients.audit.record).toHaveBeenCalledWith(expect.objectContaining({ action: "course.create", targetId: COURSE.id }));
  });

  it("records nothing when the change failed", async () => {
    staff.clients.catalog.updateCourse.mockRejectedValue(new CourseNotFoundError());

    expect((await renameCourse()).statusCode).toBe(404);
    expect(staff.clients.audit.record).not.toHaveBeenCalled();
  });

  it("records nothing for a route that only reads", async () => {
    staff.clients.catalog.listCourses.mockResolvedValue([COURSE]);

    await staff.app.inject({ method: "GET", url: "/courses", headers: staff.headers });

    expect(staff.clients.audit.record).not.toHaveBeenCalled();
  });

  it("still answers with the change, and logs an error, when the entry cannot be written", async () => {
    const logError = vi.spyOn(Logger.prototype, "error").mockImplementation(() => undefined);
    staff.clients.catalog.updateCourse.mockResolvedValue({ ...COURSE, title: "Renamed" });
    staff.clients.audit.record.mockRejectedValue(new Error("db down"));

    const response = await renameCourse();

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({ course: { ...COURSE, title: "Renamed" } });
    expect(logError).toHaveBeenCalledWith(new Error("db down"), expect.stringContaining("Audit entry not written"));
  });
});
