import { InvalidUnsubscribeLinkError } from "@reanit/core/notifications";
import { describe, expect, it } from "vitest";

import { TEST_SCHOOL, TEST_USER, useStaffApp } from "../test/session";

const PREFERENCES = { newSale: false, newComment: true, courseCompleted: true, locale: "km" } as const;
const TOKEN = "6f1c1f3e-1c5a-4a8e-9a39-2c1f1d9e0a01";
const staff = useStaffApp();

describe("GET /notifications/preferences", () => {
  it("returns an instructor's own settings for their school", async () => {
    staff.clients.notificationPreferences.getPreferences.mockResolvedValue(PREFERENCES);

    const response = await staff.app.inject({ method: "GET", url: "/notifications/preferences", headers: staff.headers });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({ preferences: PREFERENCES });
    expect(staff.clients.notificationPreferences.getPreferences).toHaveBeenCalledWith(TEST_SCHOOL.id, TEST_USER.id);
  });

  it("answers 401 when signed out", async () => {
    const response = await staff.app.inject({ method: "GET", url: "/notifications/preferences" });

    expect(response.statusCode).toBe(401);
  });
});

describe("PUT /notifications/preferences", () => {
  it("saves the caller's parsed settings", async () => {
    staff.clients.notificationPreferences.savePreferences.mockResolvedValue(PREFERENCES);

    const response = await staff.app.inject({ method: "PUT", url: "/notifications/preferences", headers: staff.headers, payload: PREFERENCES });

    expect(response.statusCode).toBe(200);
    expect(staff.clients.notificationPreferences.savePreferences).toHaveBeenCalledWith(TEST_SCHOOL.id, TEST_USER.id, PREFERENCES);
  });

  it("answers 400 for a language emails are not written in", async () => {
    const response = await staff.app.inject({
      method: "PUT",
      url: "/notifications/preferences",
      headers: staff.headers,
      payload: { ...PREFERENCES, locale: "fr" },
    });

    expect(response.statusCode).toBe(400);
    expect(staff.clients.notificationPreferences.savePreferences).not.toHaveBeenCalled();
  });
});

describe("POST /notifications/unsubscribe", () => {
  it("stops the kind of email for the token's owner, signed out", async () => {
    staff.clients.notificationPreferences.unsubscribe.mockResolvedValue({ schoolName: "Angkor Academy" });

    const response = await staff.app.inject({ method: "POST", url: "/notifications/unsubscribe", payload: { token: TOKEN, kind: "newSale" } });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({ schoolName: "Angkor Academy" });
    expect(staff.clients.notificationPreferences.unsubscribe).toHaveBeenCalledWith({ token: TOKEN, kind: "newSale" });
  });

  it("answers 404 for a token nobody has", async () => {
    staff.clients.notificationPreferences.unsubscribe.mockRejectedValue(new InvalidUnsubscribeLinkError());

    const response = await staff.app.inject({ method: "POST", url: "/notifications/unsubscribe", payload: { token: TOKEN, kind: "newSale" } });

    expect(response.statusCode).toBe(404);
    expect(response.json()).toMatchObject({ type: "urn:reanit:problem:invalid-unsubscribe-link" });
  });

  it("answers 400 for a kind of email that does not exist", async () => {
    const response = await staff.app.inject({ method: "POST", url: "/notifications/unsubscribe", payload: { token: TOKEN, kind: "marketing" } });

    expect(response.statusCode).toBe(400);
  });
});
