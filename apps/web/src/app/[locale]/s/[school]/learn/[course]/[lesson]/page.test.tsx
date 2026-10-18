import { describe, expect, it } from "vitest";

import { MOCK_SCHOOL_SLUG } from "@/mocks/schools";
import { NotFoundError } from "@/test/navigation";
import { renderError, routeProps } from "@/test/render";

import LessonPage from "./page";

// The page only composes LessonView, which has its own tests; only its not-found branches are tested here.
describe("LessonPage", () => {
  it("404s when the lesson does not exist", async () => {
    const props = routeProps({ school: MOCK_SCHOOL_SLUG, course: "brand-design-basics", lesson: "9-9" });
    await expect(renderError(<LessonPage {...props} />)).resolves.toBeInstanceOf(NotFoundError);
  });

  it("404s when the student is not enrolled", async () => {
    const props = routeProps({ school: MOCK_SCHOOL_SLUG, course: "no-such-course", lesson: "1-1" });
    await expect(renderError(<LessonPage {...props} />)).resolves.toBeInstanceOf(NotFoundError);
  });
});
