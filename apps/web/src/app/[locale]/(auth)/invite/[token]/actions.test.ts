// @vitest-environment node
import { describe, expect, it, vi } from "vitest";

import { onApi, problem, requestTo } from "@/test/api";
import { RedirectError } from "@/test/navigation";
import { signIn } from "@/test/session";

import { acceptInvite } from "./actions";

vi.mock("next/headers", () => import("@/test/headers"));

const ROUTE = "POST /invites/the-token/accept";
const IDLE = { status: "idle" } as const;

describe("acceptInvite", () => {
  it("accepts the invite and opens the dashboard", async () => {
    signIn();
    onApi(ROUTE, Response.json({ school: {}, role: "instructor" }));

    await expect(acceptInvite("the-token", IDLE)).rejects.toThrow(new RedirectError("/dashboard"));
    expect(requestTo(ROUTE)).toBeDefined();
  });

  it.each([
    [403, "mismatch"],
    [410, "expired"],
    [404, "used"],
  ] as const)("reports why the API refused (%i) as %s", async (status, reason) => {
    signIn();
    onApi(ROUTE, problem(status));

    expect(await acceptInvite("the-token", IDLE)).toEqual({ status: reason });
  });

  it("sends a signed-out visitor to log in and come back to the invite", async () => {
    await expect(acceptInvite("the-token", IDLE)).rejects.toThrow(new RedirectError("/login?next=%2Finvite%2Fthe-token"));
    expect(requestTo(ROUTE)).toBeUndefined();
  });
});
