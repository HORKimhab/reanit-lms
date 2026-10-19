// @vitest-environment node
import { revalidatePath } from "next/cache";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ZodError } from "zod";

import { onApi, problem, requestTo } from "@/test/api";
import { formData as form } from "@/test/form";
import { NotFoundError, RedirectError } from "@/test/navigation";
import { signIn } from "@/test/session";

import { createCourse, deleteCourse, saveOutline, updateCourse, type CourseFormState } from "./actions";

vi.mock("next/headers", () => import("@/test/headers"));
// Cache revalidation needs a running Next server; it is a boundary, so record calls instead.
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

const IDLE: CourseFormState = { status: "idle", invalidFields: [] };
const COURSE = {
  id: "6f1c1f3e-1c5a-4a8e-9a39-2c1f1d9e0a20",
  title: "Intro to Design",
  slug: "intro-to-design",
  description: null,
  status: "draft",
};
const COURSE_URL = `/courses/${COURSE.id}`;
const OUTLINE = {
  sections: [
    {
      id: "6f1c1f3e-1c5a-4a8e-9a39-2c1f1d9e0a01",
      title: "Basics",
      lessons: [{ id: "6f1c1f3e-1c5a-4a8e-9a39-2c1f1d9e0a02", title: "Hello", type: "video", durationSeconds: 90 }],
    },
  ],
};
const NO_CONTENT = new Response(null, { status: 204 });

beforeEach(() => {
  signIn();
});

describe("createCourse", () => {
  it("creates the course with the trimmed title and opens the builder", async () => {
    onApi("POST /courses", Response.json({ course: COURSE }, { status: 201 }));

    await expect(createCourse(IDLE, form({ title: " Intro to Design " }))).rejects.toEqual(
      new RedirectError("/dashboard/courses/intro-to-design"),
    );
    expect(await requestTo("POST /courses")?.json()).toEqual({ title: "Intro to Design" });
    expect(revalidatePath).toHaveBeenCalledWith("/dashboard/courses");
  });

  it("reports an invalid title without calling the API", async () => {
    expect(await createCourse(IDLE, form({ title: "" }))).toEqual({ status: "invalid", invalidFields: ["title"] });
    expect(requestTo("POST /courses")).toBeUndefined();
  });

  it("sends a signed-out visitor to log in", async () => {
    onApi("POST /courses", problem(401));

    await expect(createCourse(IDLE, form({ title: "Intro" }))).rejects.toEqual(new RedirectError("/login?next=%2Fdashboard"));
  });

  it("sends a user who runs no school to onboarding", async () => {
    onApi("POST /courses", problem(403, "urn:reanit:problem:not-school-staff"));

    await expect(createCourse(IDLE, form({ title: "Intro" }))).rejects.toEqual(new RedirectError("/onboarding"));
  });
});

describe("updateCourse", () => {
  it("sends only the submitted fields", async () => {
    onApi(`PATCH ${COURSE_URL}`, Response.json({ course: { ...COURSE, status: "published" } }));

    expect(await updateCourse(COURSE.id, IDLE, form({ status: "published" }))).toEqual({ status: "saved", invalidFields: [] });
    expect(await requestTo(`PATCH ${COURSE_URL}`)?.json()).toEqual({ status: "published" });
  });

  it("reports invalid fields without calling the API", async () => {
    expect(await updateCourse(COURSE.id, IDLE, form({ title: " ", status: "archived" }))).toEqual({
      status: "invalid",
      invalidFields: ["title", "status"],
    });
    expect(requestTo(`PATCH ${COURSE_URL}`)).toBeUndefined();
  });

  it("404s when the school has no such course", async () => {
    onApi(`PATCH ${COURSE_URL}`, problem(404, "urn:reanit:problem:course-not-found"));

    await expect(updateCourse(COURSE.id, IDLE, form({ title: "New" }))).rejects.toBeInstanceOf(NotFoundError);
  });

  it("404s without calling the API when the course id is not a UUID", async () => {
    await expect(updateCourse("intro", IDLE, form({ title: "New" }))).rejects.toBeInstanceOf(NotFoundError);
    expect(requestTo("PATCH /courses/intro")).toBeUndefined();
  });
});

describe("deleteCourse", () => {
  it("deletes the course and returns to the course list", async () => {
    onApi(`DELETE ${COURSE_URL}`, NO_CONTENT);

    await expect(deleteCourse(COURSE.id)).rejects.toEqual(new RedirectError("/dashboard/courses"));
    expect(requestTo(`DELETE ${COURSE_URL}`)).toBeDefined();
  });

  it("throws when the API fails", async () => {
    onApi(`DELETE ${COURSE_URL}`, problem(500));

    await expect(deleteCourse(COURSE.id)).rejects.toThrow("API answered 500");
  });
});

describe("saveOutline", () => {
  it("sends the parsed outline", async () => {
    onApi(`PUT ${COURSE_URL}/outline`, NO_CONTENT);

    await saveOutline(COURSE.id, OUTLINE);

    expect(await requestTo(`PUT ${COURSE_URL}/outline`)?.json()).toEqual(OUTLINE);
  });

  it("throws a ZodError for a malformed outline without calling the API", async () => {
    await expect(saveOutline(COURSE.id, { sections: [{ id: "s1" }] })).rejects.toBeInstanceOf(ZodError);
    expect(requestTo(`PUT ${COURSE_URL}/outline`)).toBeUndefined();
  });

  it("404s when the school has no such course", async () => {
    onApi(`PUT ${COURSE_URL}/outline`, problem(404));

    await expect(saveOutline(COURSE.id, OUTLINE)).rejects.toBeInstanceOf(NotFoundError);
  });
});
