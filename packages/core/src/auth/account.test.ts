import { describe, expect, it } from "vitest";

import type { StudentErased } from "../events";
import { FakeAccountStore, FakeClock } from "../test/auth-fakes";
import { FakeObjectStorage } from "../test/media-fakes";
import { createAccountService, createErasureCleanup, deleteAccountSchema } from "./account";
import { AccountRunsSchoolError, DeletionNotConfirmedError } from "./errors";
import type { UserDataExport } from "./ports";

const NOW = new Date("2026-10-26T00:00:00Z");
const USER = { id: "user-1", email: "sokha@example.com", name: "Sokha" };
const DATA: UserDataExport = {
  account: { ...USER, createdAt: new Date("2026-01-01T00:00:00Z") },
  memberships: [{ school: "Angkor Academy", role: "student", joinedAt: new Date("2026-01-02T00:00:00Z") }],
  enrollments: [],
  orders: [],
  quizAttempts: [],
  comments: [],
  certificates: [],
};

/**
 * Builds the account service over a fake store holding `DATA` for `USER`, with a fixed clock.
 *
 * @param store The account store.
 * @returns The service.
 */
function accountService(store = new FakeAccountStore()) {
  store.exports.set(USER.id, DATA);
  return createAccountService({ store, clock: new FakeClock(NOW) });
}

describe("exportData", () => {
  it("returns everything stored about the person, stamped with the time", async () => {
    expect(await accountService().exportData(USER.id)).toEqual({ exportedAt: NOW, ...DATA });
  });

  it("throws for an account that no longer exists", async () => {
    await expect(accountService().exportData("gone")).rejects.toThrow("No account gone to export");
  });
});

describe("deleteAccount", () => {
  it("erases a student who confirms with their email", async () => {
    const store = new FakeAccountStore();

    await accountService(store).deleteAccount(USER, deleteAccountSchema.parse({ confirmEmail: " Sokha@Example.com " }));

    expect(store.erased).toEqual([USER.id]);
  });

  it("throws DeletionNotConfirmedError and erases nothing when the typed email is another", async () => {
    const store = new FakeAccountStore();

    await expect(accountService(store).deleteAccount(USER, { confirmEmail: "dara@example.com" })).rejects.toThrow(DeletionNotConfirmedError);
    expect(store.erased).toEqual([]);
  });

  it("throws AccountRunsSchoolError and erases nothing for a school's staff", async () => {
    const store = new FakeAccountStore();
    store.staffIds.add(USER.id);

    await expect(accountService(store).deleteAccount(USER, { confirmEmail: USER.email })).rejects.toThrow(AccountRunsSchoolError);
    expect(store.erased).toEqual([]);
  });
});

describe("createErasureCleanup", () => {
  it("deletes every file the erasure lists, and repeating it is harmless", async () => {
    const storage = new FakeObjectStorage();
    await storage.put({ key: "schools/s1/certificates/c1.pdf", contentType: "application/pdf", body: new Uint8Array() });
    await storage.put({ key: "schools/s1/certificates/c2.pdf", contentType: "application/pdf", body: new Uint8Array() });
    await storage.put({ key: "schools/s1/certificates/kept.pdf", contentType: "application/pdf", body: new Uint8Array() });
    const event: StudentErased = { type: "StudentErased", schoolId: "s1", payload: { fileKeys: ["schools/s1/certificates/c1.pdf", "schools/s1/certificates/c2.pdf"] } };
    const cleanup = createErasureCleanup(storage);

    await cleanup.removeFiles(event);
    await cleanup.removeFiles(event);

    expect([...storage.stored.keys()]).toEqual(["schools/s1/certificates/kept.pdf"]);
  });
});
