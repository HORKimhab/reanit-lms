// @vitest-environment node
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

import { onApi, problem } from "@/test/api";
import { NotFoundError, RedirectError } from "@/test/navigation";
import { PLAYER_COURSE } from "@/test/player";
import { routeProps } from "@/test/render";

import ResumeCourse from "./page";

vi.mock("next/headers", () => import("@/test/headers"));
vi.mock("next-intl/server", () => import("@/test/intl-server"));

const ROUTE = "GET /schools/by-subdomain/angkor/learn/brand-design-basics";
const PROPS = routeProps({ school: "angkor", course: "brand-design-basics" });

describe("ResumeCourse", () => {
  it("redirects to the first lesson not completed", async () => {
    onApi(ROUTE, Response.json({ course: PLAYER_COURSE }));

    await expect(ResumeCourse(PROPS)).rejects.toEqual(new RedirectError("/s/angkor/learn/brand-design-basics/6f1c1f3e-1c5a-4a8e-9a39-2c1f1d9e0a03"));
  });

  it("says the course has no lessons yet instead of failing", async () => {
    onApi(ROUTE, Response.json({ course: { ...PLAYER_COURSE, sections: [], progress: [] } }));

    const html = renderToStaticMarkup(await ResumeCourse(PROPS));

    expect(html).toContain("No lessons yet");
    expect(html).toContain("This course has no lessons yet.");
  });

  it("404s when the student is not enrolled", async () => {
    onApi(ROUTE, problem(403));

    await expect(ResumeCourse(PROPS)).rejects.toBeInstanceOf(NotFoundError);
  });
});
