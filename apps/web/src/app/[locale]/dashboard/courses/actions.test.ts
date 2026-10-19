// @vitest-environment node
import { CourseNotFoundError } from "@reanit/core/catalog";
import { revalidatePath } from "next/cache";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ZodError } from "zod";

import { catalogService, COURSE, getCatalogService } from "@/test/catalog-service";
import { formData as form } from "@/test/form";
import { cookieJar } from "@/test/headers";
import { NotFoundError, RedirectError } from "@/test/navigation";
import { schoolService, STAFF_SCHOOL } from "@/test/school-service";
import { signIn } from "@/test/session";

import { createCourse, deleteCourse, saveOutline, updateCourse, type CourseFormState } from "./actions";

vi.mock("next/headers", () => import("@/test/headers"));
// Cache revalidation needs a running Next server; it is a boundary, so record calls instead.
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/server/auth/service", () => import("@/test/auth-service"));
vi.mock("@/server/schools/service", () => import("@/test/school-service"));
vi.mock("@/server/catalog/service", () => import("@/test/catalog-service"));

const IDLE: CourseFormState = { status: "idle", invalidFields: [] };
const OUTLINE = {
  sections: [
    {
      id: "6f1c1f3e-1c5a-4a8e-9a39-2c1f1d9e0a01",
      title: "Basics",
      lessons: [{ id: "6f1c1f3e-1c5a-4a8e-9a39-2c1f1d9e0a02", title: "Hello", type: "video", durationSeconds: 90 }],
    },
  ],
};

beforeEach(() => {
  signIn();
  schoolService.getStaffSchool.mockResolvedValue(STAFF_SCHOOL);
});

describe("createCourse", () => {
  it("creates the course in the creator's school and opens the builder", async () => {
    catalogService.createCourse.mockResolvedValue(COURSE);

    await expect(createCourse(IDLE, form({ title: " Intro to Design " }))).rejects.toEqual(
      new RedirectError("/dashboard/courses/intro-to-design"),
    );
    expect(getCatalogService).toHaveBeenCalledWith(STAFF_SCHOOL.school.id);
    expect(catalogService.createCourse).toHaveBeenCalledWith({ title: "Intro to Design" });
    expect(revalidatePath).toHaveBeenCalledWith("/dashboard/courses");
  });

  it("reports an invalid title", async () => {
    expect(await createCourse(IDLE, form({ title: "" }))).toEqual({ status: "invalid", invalidFields: ["title"] });
    expect(catalogService.createCourse).not.toHaveBeenCalled();
  });

  it("sends a signed-out visitor to log in", async () => {
    cookieJar.clear();

    await expect(createCourse(IDLE, form({ title: "Intro" }))).rejects.toEqual(new RedirectError("/login?next=%2Fdashboard"));
  });
});

describe("updateCourse", () => {
  it("saves only the submitted fields", async () => {
    catalogService.updateCourse.mockResolvedValue({ ...COURSE, status: "published" });

    expect(await updateCourse(COURSE.id, IDLE, form({ status: "published" }))).toEqual({ status: "saved", invalidFields: [] });
    expect(catalogService.updateCourse).toHaveBeenCalledWith(COURSE.id, { status: "published" });
  });

  it("reports invalid fields without saving", async () => {
    expect(await updateCourse(COURSE.id, IDLE, form({ title: " ", status: "archived" }))).toEqual({
      status: "invalid",
      invalidFields: ["title", "status"],
    });
    expect(catalogService.updateCourse).not.toHaveBeenCalled();
  });

  it("404s when the school has no such course", async () => {
    catalogService.updateCourse.mockRejectedValue(new CourseNotFoundError());

    await expect(updateCourse(COURSE.id, IDLE, form({ title: "New" }))).rejects.toBeInstanceOf(NotFoundError);
  });

  it("404s when the course id is not a UUID", async () => {
    await expect(updateCourse("intro", IDLE, form({ title: "New" }))).rejects.toBeInstanceOf(NotFoundError);
    expect(catalogService.updateCourse).not.toHaveBeenCalled();
  });
});

describe("deleteCourse", () => {
  it("deletes the course and returns to the course list", async () => {
    await expect(deleteCourse(COURSE.id)).rejects.toEqual(new RedirectError("/dashboard/courses"));
    expect(catalogService.deleteCourse).toHaveBeenCalledWith(COURSE.id);
  });

  it("rethrows unexpected failures", async () => {
    catalogService.deleteCourse.mockRejectedValue(new Error("database down"));

    await expect(deleteCourse(COURSE.id)).rejects.toThrow("database down");
  });
});

describe("saveOutline", () => {
  it("saves the parsed outline to the creator's school", async () => {
    await saveOutline(COURSE.id, OUTLINE);

    expect(getCatalogService).toHaveBeenCalledWith(STAFF_SCHOOL.school.id);
    expect(catalogService.saveOutline).toHaveBeenCalledWith(COURSE.id, OUTLINE);
  });

  it("throws a ZodError for a malformed outline without saving", async () => {
    await expect(saveOutline(COURSE.id, { sections: [{ id: "s1" }] })).rejects.toBeInstanceOf(ZodError);
    expect(catalogService.saveOutline).not.toHaveBeenCalled();
  });

  it("404s when the school has no such course", async () => {
    catalogService.saveOutline.mockRejectedValue(new CourseNotFoundError());

    await expect(saveOutline(COURSE.id, OUTLINE)).rejects.toBeInstanceOf(NotFoundError);
  });
});
