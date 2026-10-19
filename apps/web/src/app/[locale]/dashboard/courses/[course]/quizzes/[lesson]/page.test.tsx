// @vitest-environment node
import { describe, expect, it, vi } from "vitest";

import { onApi } from "@/test/api";
import { NotFoundError } from "@/test/navigation";
import { routeProps } from "@/test/render";
import { signIn } from "@/test/session";

import QuizEditorPage from "./page";

vi.mock("next/headers", () => import("@/test/headers"));
vi.mock("next-intl/server", () => import("@/test/intl-server"));

// The page only composes QuizEditor, which has its own tests; its not-found branch is tested here.
describe("QuizEditorPage", () => {
  it("404s on a lesson the course does not have", async () => {
    signIn();
    onApi(
      "GET /courses/by-slug/brand",
      Response.json({ course: { id: "6f1c1f3e-1c5a-4a8e-9a39-2c1f1d9e0a20", title: "Brand", slug: "brand", description: null, status: "draft", sections: [] } }),
    );

    await expect(QuizEditorPage(routeProps({ course: "brand", lesson: "6f1c1f3e-1c5a-4a8e-9a39-2c1f1d9e0a60" }))).rejects.toBeInstanceOf(NotFoundError);
  });
});
