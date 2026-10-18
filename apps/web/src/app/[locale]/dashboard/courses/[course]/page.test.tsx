import { describe, expect, it } from "vitest";

import { NotFoundError } from "@/test/navigation";
import { renderError, routeProps } from "@/test/render";

import CourseBuilderPage from "./page";

// The page only composes the builder, which has its own tests; only its not-found branch is tested here.
describe("CourseBuilderPage", () => {
  it("returns 404 when the school has no course with that slug", async () => {
    expect(await renderError(<CourseBuilderPage {...routeProps({ course: "no-such-course" })} />)).toBeInstanceOf(
      NotFoundError,
    );
  });
});
