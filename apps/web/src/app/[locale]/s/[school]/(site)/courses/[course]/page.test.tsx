import { describe, expect, it } from "vitest";

import { MOCK_SCHOOL_SLUG } from "@/mocks/schools";
import { NotFoundError } from "@/test/navigation";
import { renderError, routeProps } from "@/test/render";

import CoursePage from "./page";

// The page only composes CourseDetails, which has its own tests; only its not-found branch is tested here.
describe("CoursePage", () => {
  it("404s when the course does not exist in the school", async () => {
    const props = routeProps({ school: MOCK_SCHOOL_SLUG, course: "no-such-course" });
    await expect(renderError(<CoursePage {...props} />)).resolves.toBeInstanceOf(NotFoundError);
  });
});
