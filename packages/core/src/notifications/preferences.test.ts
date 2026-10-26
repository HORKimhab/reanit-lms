import { describe, expect, it } from "vitest";

import { FakePreferenceStore } from "../test/notification-fakes";
import { InvalidUnsubscribeLinkError } from "./errors";
import { createNotificationPreferences } from "./preferences";
import { DEFAULT_NOTIFICATION_PREFERENCES } from "./rules";

const TOKEN = "6f1c1f3e-1c5a-4a8e-9a39-2c1f1d9e0a01";

describe("createNotificationPreferences", () => {
  it("gives every email in English to a staff member who never saved settings", async () => {
    expect(await createNotificationPreferences(new FakePreferenceStore()).getPreferences("school-1", "user-1")).toEqual(DEFAULT_NOTIFICATION_PREFERENCES);
  });

  it("returns saved settings for that school only", async () => {
    const preferences = createNotificationPreferences(new FakePreferenceStore());
    const saved = { newSale: false, newComment: true, courseCompleted: false, locale: "km" } as const;

    await preferences.savePreferences("school-1", "user-1", saved);

    expect(await preferences.getPreferences("school-1", "user-1")).toEqual(saved);
    expect(await preferences.getPreferences("school-2", "user-1")).toEqual(DEFAULT_NOTIFICATION_PREFERENCES);
  });

  it("turns off the kind an unsubscribe link names and returns the school's name", async () => {
    const store = new FakePreferenceStore();
    store.tokens.set(TOKEN, { schoolId: "school-1", userId: "user-1", schoolName: "Angkor Academy" });
    const preferences = createNotificationPreferences(store);

    expect(await preferences.unsubscribe({ token: TOKEN, kind: "newComment" })).toEqual({ schoolName: "Angkor Academy" });
    expect(await preferences.getPreferences("school-1", "user-1")).toEqual({ ...DEFAULT_NOTIFICATION_PREFERENCES, newComment: false });
  });

  it("throws InvalidUnsubscribeLinkError for a token nobody has", async () => {
    await expect(createNotificationPreferences(new FakePreferenceStore()).unsubscribe({ token: TOKEN, kind: "newSale" })).rejects.toThrow(
      InvalidUnsubscribeLinkError,
    );
  });
});
