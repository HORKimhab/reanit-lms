import { describe, expect, it, vi } from "vitest";

import { MOCK_SCHOOL_SLUG } from "@/mocks/schools";
import { NotFoundError, RedirectError } from "@/test/navigation";
import { routeProps } from "@/test/render";

import ResumeCourse from "./page";

vi.mock("next-intl/server", () => import("@/test/intl-server"));

describe("ResumeCourse", () => {
  it("redirects to the first unfinished lesson", async () => {
    const result = ResumeCourse(routeProps({ school: MOCK_SCHOOL_SLUG, course: "brand-design-basics" }));
    await expect(result).rejects.toEqual(new RedirectError(`/s/${MOCK_SCHOOL_SLUG}/learn/brand-design-basics/2-2`));
  });

  it("redirects to the last lesson when the course is completed", async () => {
    const result = ResumeCourse(routeProps({ school: MOCK_SCHOOL_SLUG, course: "social-media-content" }));
    await expect(result).rejects.toEqual(new RedirectError(`/s/${MOCK_SCHOOL_SLUG}/learn/social-media-content/2-2`));
  });

  it("404s when the student is not enrolled", async () => {
    const result = ResumeCourse(routeProps({ school: MOCK_SCHOOL_SLUG, course: "no-such-course" }));
    await expect(result).rejects.toBeInstanceOf(NotFoundError);
  });
});
