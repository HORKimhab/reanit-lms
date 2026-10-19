// @vitest-environment node
import { describe, expect, it, vi } from "vitest";

import { onApi } from "@/test/api";
import { NotFoundError } from "@/test/navigation";
import { PLAYER_COURSE } from "@/test/player";
import { routeProps } from "@/test/render";

import LessonPage from "./page";

vi.mock("next/headers", () => import("@/test/headers"));

// The page only composes LessonView, which has its own tests; only its not-found branch is tested here.
describe("LessonPage", () => {
  it("404s when the course has no such lesson", async () => {
    onApi("GET /schools/by-subdomain/angkor/learn/brand-design-basics", Response.json({ course: PLAYER_COURSE }));

    const props = routeProps({ school: "angkor", course: "brand-design-basics", lesson: "6f1c1f3e-1c5a-4a8e-9a39-2c1f1d9e0aff" });
    await expect(LessonPage(props)).rejects.toBeInstanceOf(NotFoundError);
  });
});
