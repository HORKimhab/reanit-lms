import { CourseNotFoundError, type Course } from "@reanit/core/catalog";
import { NotSchoolStaffError } from "@reanit/core/schools";
import { describe, expect, it } from "vitest";

import { TEST_SCHOOL, useStaffApp } from "../test/session";

const COURSE: Course = {
  id: "3c2b1a09-8f7e-4d6c-9b5a-4e3d2c1b0a99",
  title: "Intro to Design",
  slug: "intro-to-design",
  description: null,
  status: "draft",
};
const OUTLINE = {
  sections: [
    {
      id: "6f1c1f3e-1c5a-4a8e-9a39-2c1f1d9e0a01",
      title: "Basics",
      lessons: [{ id: "6f1c1f3e-1c5a-4a8e-9a39-2c1f1d9e0a02", title: "Hello", type: "video", durationSeconds: 90 }],
    },
  ],
};

const staff = useStaffApp();

describe("staff course routes", () => {
  it("lists the courses of the caller's school only", async () => {
    staff.clients.catalog.listCourses.mockResolvedValue([COURSE]);

    const response = await staff.app.inject({ method: "GET", url: "/courses", headers: staff.headers });

    expect(response.json()).toEqual({ courses: [COURSE] });
    expect(staff.clients.catalogFor).toHaveBeenCalledWith(TEST_SCHOOL.id);
  });

  it("creates a draft course from the trimmed title", async () => {
    staff.clients.catalog.createCourse.mockResolvedValue(COURSE);

    const response = await staff.app.inject({ method: "POST", url: "/courses", headers: staff.headers, payload: { title: "  Intro to Design " } });

    expect(response.statusCode).toBe(201);
    expect(response.json()).toEqual({ course: COURSE });
    expect(staff.clients.catalog.createCourse).toHaveBeenCalledWith({ title: "Intro to Design" });
  });

  it("answers 400 for a blank title", async () => {
    const response = await staff.app.inject({ method: "POST", url: "/courses", headers: staff.headers, payload: { title: "  " } });

    expect(response.statusCode).toBe(400);
    expect(staff.clients.catalog.createCourse).not.toHaveBeenCalled();
  });

  it("loads a course with its outline by slug", async () => {
    staff.clients.catalog.getCourse.mockResolvedValue({ ...COURSE, ...OUTLINE });

    const response = await staff.app.inject({ method: "GET", url: `/courses/by-slug/${COURSE.slug}`, headers: staff.headers });

    expect(response.json()).toEqual({ course: { ...COURSE, ...OUTLINE } });
    expect(staff.clients.catalog.getCourse).toHaveBeenCalledWith(COURSE.slug);
  });

  it("updates only the fields sent", async () => {
    staff.clients.catalog.updateCourse.mockResolvedValue({ ...COURSE, status: "published" });

    const response = await staff.app.inject({ method: "PATCH", url: `/courses/${COURSE.id}`, headers: staff.headers, payload: { status: "published" } });

    expect(response.json()).toEqual({ course: { ...COURSE, status: "published" } });
    expect(staff.clients.catalog.updateCourse).toHaveBeenCalledWith(COURSE.id, { status: "published" });
  });

  it("deletes a course", async () => {
    const response = await staff.app.inject({ method: "DELETE", url: `/courses/${COURSE.id}`, headers: staff.headers });

    expect(response.statusCode).toBe(204);
    expect(staff.clients.catalog.deleteCourse).toHaveBeenCalledWith(COURSE.id);
  });

  it("saves the outline", async () => {
    const response = await staff.app.inject({ method: "PUT", url: `/courses/${COURSE.id}/outline`, headers: staff.headers, payload: OUTLINE });

    expect(response.statusCode).toBe(204);
    const [section] = OUTLINE.sections;
    expect(staff.clients.catalog.saveOutline).toHaveBeenCalledWith(COURSE.id, {
      sections: [{ ...section, lessons: section?.lessons.map((lesson) => ({ ...lesson, unlockAfterDays: null, unlockAt: null })) }],
    });
  });

  it("passes a lesson's drip date on", async () => {
    const [section] = OUTLINE.sections;
    const payload = { sections: [{ ...section, lessons: section?.lessons.map((lesson) => ({ ...lesson, unlockAt: "2026-12-01T00:00:00Z" })) }] };

    await staff.app.inject({ method: "PUT", url: `/courses/${COURSE.id}/outline`, headers: staff.headers, payload });

    expect(staff.clients.catalog.saveOutline.mock.calls[0]?.[1].sections[0].lessons[0].unlockAt).toBe("2026-12-01T00:00:00Z");
  });

  it("answers 400 for an outline that repeats an id", async () => {
    const [section] = OUTLINE.sections;
    const payload = { sections: [section, section] };

    const response = await staff.app.inject({ method: "PUT", url: `/courses/${COURSE.id}/outline`, headers: staff.headers, payload });

    expect(response.statusCode).toBe(400);
    expect(staff.clients.catalog.saveOutline).not.toHaveBeenCalled();
  });

  it("answers 400 for a course id that is not a UUID", async () => {
    const response = await staff.app.inject({ method: "DELETE", url: "/courses/not-a-uuid", headers: staff.headers });

    expect(response.statusCode).toBe(400);
  });

  it("answers 404 when the school has no such course", async () => {
    staff.clients.catalog.deleteCourse.mockRejectedValue(new CourseNotFoundError());

    const response = await staff.app.inject({ method: "DELETE", url: `/courses/${COURSE.id}`, headers: staff.headers });

    expect(response.statusCode).toBe(404);
    expect(response.json()).toMatchObject({ type: "urn:reanit:problem:course-not-found" });
  });

  it("answers 403 and touches no catalog when the user runs no school", async () => {
    staff.clients.schools.getStaffSchool.mockRejectedValue(new NotSchoolStaffError());

    const response = await staff.app.inject({ method: "GET", url: "/courses", headers: staff.headers });

    expect(response.statusCode).toBe(403);
    expect(staff.clients.catalogFor).not.toHaveBeenCalled();
  });

  it("answers 401 when signed out", async () => {
    const response = await staff.app.inject({ method: "GET", url: "/courses" });

    expect(response.statusCode).toBe(401);
    expect(staff.clients.catalogFor).not.toHaveBeenCalled();
  });
});
