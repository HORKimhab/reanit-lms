import { randomUUID } from "node:crypto";

import { afterAll, beforeAll, describe, expect, inject, it } from "vitest";

import { createDbClient, createNotificationPreferenceStore, createStaffNoticeStore, forSchool } from "../src";
import { openTestSchool } from "../src/test/schools";

const db = createDbClient(inject("databaseUrl"));
const store = createNotificationPreferenceStore(db);
const SAVED = { newSale: false, newComment: true, courseCompleted: false, locale: "km" } as const;
let schoolId: string;
let otherSchoolId: string;
let ownerId: string;

beforeAll(async () => {
  schoolId = await openTestSchool(db, "preferences-alpha");
  otherSchoolId = await openTestSchool(db, "preferences-beta");
  ownerId = (await db.membership.findFirstOrThrow({ where: { schoolId, role: "owner" }, select: { userId: true } })).userId;
});

afterAll(async () => {
  await db.$disconnect();
});

describe("notification preference store", () => {
  it("saves a staff member's settings for one school, and finds none for another", async () => {
    expect(await store.savePreferences(schoolId, ownerId, SAVED)).toEqual(SAVED);

    expect(await store.findPreferences(schoolId, ownerId)).toEqual(SAVED);
    expect(await store.findPreferences(otherSchoolId, ownerId)).toBeNull();
    expect(await forSchool(db, otherSchoolId).notificationPreference.count()).toBe(0);
  });

  it("turns off the kind an unsubscribe token names, and returns the school's name", async () => {
    const [recipient] = await createStaffNoticeStore(db, otherSchoolId).findRecipients("newComment", ["owner"]);

    expect(await store.unsubscribe(recipient!.unsubscribeToken, "newComment")).toEqual({ schoolName: "preferences-beta" }); // the school has an owner

    const owner = (await db.membership.findFirstOrThrow({ where: { schoolId: otherSchoolId, role: "owner" }, select: { userId: true } })).userId;
    expect(await store.findPreferences(otherSchoolId, owner)).toEqual({ newSale: true, newComment: false, courseCompleted: true, locale: "en", subscriptionId: null });
  });

  it("returns null for a token nobody has", async () => {
    expect(await store.unsubscribe(randomUUID(), "newSale")).toBeNull();
  });
});
