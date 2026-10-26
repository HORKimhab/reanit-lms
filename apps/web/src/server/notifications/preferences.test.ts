// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";

import { onApi, problem } from "@/test/api";
import { RedirectError } from "@/test/navigation";
import { signIn } from "@/test/session";

import { getNotificationPreferences } from "./preferences";

vi.mock("next/headers", () => import("@/test/headers"));

beforeEach(() => {
  signIn();
});

describe("getNotificationPreferences", () => {
  it("returns the staff member's email settings", async () => {
    const preferences = { newSale: false, newComment: true, courseCompleted: true, locale: "km" };
    onApi("GET /notifications/preferences", Response.json({ preferences }));

    expect(await getNotificationPreferences()).toEqual(preferences);
  });

  it("sends a user who runs no school to onboarding", async () => {
    onApi("GET /notifications/preferences", problem(403, "urn:reanit:problem:not-school-staff"));

    await expect(getNotificationPreferences()).rejects.toThrow(RedirectError);
  });
});
