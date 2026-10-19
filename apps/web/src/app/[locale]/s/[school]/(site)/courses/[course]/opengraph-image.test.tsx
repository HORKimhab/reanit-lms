// @vitest-environment node
import { describe, expect, it, vi } from "vitest";

import { onApi, problem } from "@/test/api";
import { routeProps } from "@/test/render";
import { PUBLISHED_COURSE_WITH_OUTLINE } from "@/test/site";

import CourseShareImage, { contentType, size } from "./opengraph-image";

vi.mock("next/headers", () => import("@/test/headers"));
vi.mock("next-intl/server", () => import("@/test/intl-server"));

const SCHOOL = { id: "6f1c1f3e-1c5a-4a8e-9a39-2c1f1d9e0a10", name: "Angkor Academy", subdomain: "angkor", brandColor: "#0055aa", logoUrl: null };
/** PNG files start with these bytes. */
const PNG_SIGNATURE = [0x89, 0x50, 0x4e, 0x47];

describe("CourseShareImage", () => {
  it("draws the course's share card as a PNG, even when the Khmer font cannot be fetched", async () => {
    onApi("GET /schools/by-subdomain/angkor", Response.json({ school: SCHOOL, owner: { name: "Dara Sok" } }));
    onApi("GET /schools/by-subdomain/angkor/courses/brand-design-basics", Response.json({ course: PUBLISHED_COURSE_WITH_OUTLINE }));
    onApi("GET /css2", problem(503));

    const image = await CourseShareImage(routeProps({ school: "angkor", course: "brand-design-basics" }));

    expect(contentType).toBe("image/png");
    expect(size).toEqual({ width: 1200, height: 630 });
    expect([...new Uint8Array(await image.arrayBuffer()).slice(0, PNG_SIGNATURE.length)]).toEqual(PNG_SIGNATURE);
  });
});
