import { z } from "zod";

import type { StudentErased } from "../events";
import type { ObjectStorage } from "../media";
import { AccountRunsSchoolError, DeletionNotConfirmedError } from "./errors";
import type { AccountStore, AuthUser, Clock, UserDataExport } from "./ports";
import { emailSchema } from "./schemas";

/** Delete-account form: the account's email, typed again to confirm. */
export const deleteAccountSchema = z.object({ confirmEmail: emailSchema });

/** Parsed delete-account input. */
export type DeleteAccountInput = z.infer<typeof deleteAccountSchema>;

/** What `createAccountService` needs. */
export interface AccountDependencies {
  store: AccountStore;
  /** Stamps when an export was made. */
  clock: Clock;
}

/**
 * Builds a person's data rights over their own account (GDPR): a copy of everything stored about
 * them, and erasure. Erasure keeps the schools' orders, which their accounts need, tied to an
 * account that no longer says who it was.
 *
 * @param dependencies Store and clock.
 * @param dependencies.store Reads and erases the person's data across schools.
 * @param dependencies.clock Stamps the export.
 * @returns The account operations.
 * @example
 * const account = createAccountService({ store: createAccountStore(db), clock });
 * await account.deleteAccount(user, { confirmEmail: user.email });
 */
export function createAccountService({ store, clock }: AccountDependencies) {
  return {
    /**
     * Collects everything stored about the signed-in person, across every school.
     *
     * @param userId The signed-in person.
     * @returns Their data, stamped with when it was exported.
     * @throws {Error} When the account no longer exists.
     */
    async exportData(userId: string): Promise<UserDataExport & { exportedAt: Date }> {
      const data = await store.exportUserData(userId);
      if (!data) throw new Error(`No account ${userId} to export`);
      return { exportedAt: clock.now(), ...data };
    },

    /**
     * Erases the signed-in person's account once they confirm it with their email. Staff of a school
     * are refused until they leave its team, so no school is left without its owner.
     *
     * @param user The signed-in person.
     * @param input The email typed to confirm.
     * @param input.confirmEmail The typed email, normalized.
     * @throws {DeletionNotConfirmedError} When the typed email is not the account's.
     * @throws {AccountRunsSchoolError} When the person is an owner, admin or instructor of a school.
     */
    async deleteAccount(user: AuthUser, { confirmEmail }: DeleteAccountInput): Promise<void> {
      if (confirmEmail !== user.email) throw new DeletionNotConfirmedError();
      if (await store.isSchoolStaff(user.id)) throw new AccountRunsSchoolError();
      await store.eraseUser(user.id);
    },
  };
}

/** The account data rights use cases. */
export type AccountService = ReturnType<typeof createAccountService>;

/**
 * Builds the worker's clean-up after an erasure: it deletes the school's files that named the student,
 * such as certificate PDFs. Files already gone count as deleted, so a retried job is harmless.
 *
 * @param storage Object storage holding the files.
 * @returns The clean-up operation.
 * @example
 * const cleanup = createErasureCleanup(storage);
 * await cleanup.removeFiles(event);
 */
export function createErasureCleanup(storage: ObjectStorage) {
  return {
    /**
     * Deletes every file the event lists.
     *
     * @param event The `StudentErased` event.
     * @param event.payload The files' keys.
     * @throws {Error} When storage refuses a delete, so the job is retried.
     */
    async removeFiles({ payload }: StudentErased): Promise<void> {
      for (const key of payload.fileKeys) await storage.remove(key);
    },
  };
}
