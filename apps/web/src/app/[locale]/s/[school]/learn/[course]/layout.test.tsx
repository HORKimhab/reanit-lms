// @vitest-environment node
import { describe, expect, it, vi } from "vitest";

import { onApi, problem } from "@/test/api";
import { NotFoundError } from "@/test/navigation";
import { routeParams } from "@/test/render";

import PlayerLayout from "./layout";

vi.mock("next/headers", () => import("@/test/headers"));

// The layout only composes PlayerShell, which has its own tests; only its not-found branch is tested here.
describe("PlayerLayout", () => {
  it("404s when the student is not enrolled", async () => {
    onApi("GET /schools/by-subdomain/angkor/learn/brand", problem(403));

    await expect(PlayerLayout({ children: null, params: routeParams({ school: "angkor", course: "brand" }) })).rejects.toBeInstanceOf(NotFoundError);
  });
});
