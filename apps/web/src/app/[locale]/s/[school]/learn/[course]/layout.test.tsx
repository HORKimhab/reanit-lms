import { describe, expect, it } from "vitest";

import { MOCK_SCHOOL_SLUG } from "@/mocks/schools";
import { NotFoundError } from "@/test/navigation";
import { routeParams } from "@/test/render";

import PlayerLayout from "./layout";

// The layout only composes PlayerShell, which has its own tests; only its not-found branch is tested here.
describe("PlayerLayout", () => {
  it("404s when the student is not enrolled", async () => {
    const params = routeParams({ school: MOCK_SCHOOL_SLUG, course: "no-such-course" });
    await expect(PlayerLayout({ children: null, params })).rejects.toBeInstanceOf(NotFoundError);
  });
});
