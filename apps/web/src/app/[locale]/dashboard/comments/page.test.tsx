// @vitest-environment node
import { describe, expect, it, vi } from "vitest";

import { onApi, requestTo } from "@/test/api";
import { routeProps } from "@/test/render";
import { signIn } from "@/test/session";

import DashboardComments from "./page";

vi.mock("next/headers", () => import("@/test/headers"));
vi.mock("next-intl/server", () => import("@/test/intl-server"));

// The page only composes CommentInbox, which has its own tests; its query fallback is tested here.
describe("DashboardComments", () => {
  it("falls back to the first page of unanswered threads for a query that makes no sense", async () => {
    signIn();
    onApi("GET /comments", Response.json({ threads: [], total: 0, page: 1, pageSize: 20 }));

    await DashboardComments({ ...routeProps({}), searchParams: Promise.resolve({ filter: "spam", page: "-1" }) });

    expect(new URL(requestTo("GET /comments")?.url ?? "").search).toBe("?page=1&filter=unanswered");
  });
});
