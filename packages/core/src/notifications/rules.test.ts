import { describe, expect, it } from "vitest";

import { appPageUrl, NOTIFICATION_KINDS, NOTIFICATION_ROLES, notificationPreferencesSchema, schoolPageUrl, unsubscribeSchema } from "./rules";

describe("schoolPageUrl", () => {
  it("links an English reader to the unprefixed page", () => {
    expect(schoolPageUrl({ appUrl: "https://reanit.com", locale: "en", subdomain: "angkor", path: "/learn/brand" })).toBe(
      "https://reanit.com/s/angkor/learn/brand",
    );
  });

  it("links a Khmer reader to the /km page", () => {
    expect(schoolPageUrl({ appUrl: "https://reanit.com", locale: "km", subdomain: "angkor", path: "/my-courses" })).toBe(
      "https://reanit.com/km/s/angkor/my-courses",
    );
  });

  it("keeps the app's port for local development", () => {
    expect(schoolPageUrl({ appUrl: "http://localhost:3000", locale: "en", subdomain: "angkor", path: "/my-courses" })).toBe(
      "http://localhost:3000/s/angkor/my-courses",
    );
  });
});

describe("appPageUrl", () => {
  it("links a Khmer reader to the /km page, keeping the query", () => {
    expect(appPageUrl({ appUrl: "https://reanit.com", locale: "km", path: "/unsubscribe?token=t&kind=newSale" })).toBe(
      "https://reanit.com/km/unsubscribe?token=t&kind=newSale",
    );
  });

  it("links an English reader to the unprefixed page", () => {
    expect(appPageUrl({ appUrl: "https://reanit.com", locale: "en", path: "/dashboard/comments" })).toBe("https://reanit.com/dashboard/comments");
  });
});

describe("NOTIFICATION_ROLES", () => {
  it("sends sales to owners and admins only, and learning news to instructors too", () => {
    expect(NOTIFICATION_ROLES.newSale).not.toContain("instructor");
    expect(NOTIFICATION_KINDS.filter((kind) => NOTIFICATION_ROLES[kind].includes("instructor"))).toEqual(["newComment", "courseCompleted"]);
    expect(NOTIFICATION_KINDS.every((kind) => !NOTIFICATION_ROLES[kind].includes("student"))).toBe(true);
  });
});

describe("notificationPreferencesSchema", () => {
  it("refuses a language the emails are not written in", () => {
    expect(notificationPreferencesSchema.safeParse({ newSale: true, newComment: true, courseCompleted: true, locale: "fr" }).success).toBe(false);
  });
});

describe("unsubscribeSchema", () => {
  it.each([
    { token: "not-a-uuid", kind: "newSale" },
    { token: "6f1c1f3e-1c5a-4a8e-9a39-2c1f1d9e0a01", kind: "marketing" },
  ])("refuses %j", (input) => {
    expect(unsubscribeSchema.safeParse(input).success).toBe(false);
  });
});
