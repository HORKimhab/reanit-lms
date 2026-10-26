import { Module } from "@nestjs/common";
import { APP_GUARD } from "@nestjs/core";
import { createAccountService, createAuthService, type Mailer } from "@reanit/core/auth";
import { createAccountStore, createAuthStore, type DbClient } from "@reanit/db";

import { DB_CLIENT, MAILER } from "@reanit/nest";
import { systemClock } from "../context/clock";
import { AccountController } from "./account.controller";
import { AuthController } from "./auth.controller";
import { ACCOUNT_SERVICE, AUTH_SERVICE } from "./auth.tokens";
import { SessionGuard } from "./session.guard";

/**
 * Wires the auth use cases to Postgres, SMTP and the system clock.
 *
 * @param db The shared database client.
 * @param mailer Sends the magic-link emails.
 * @returns The auth service.
 */
function provideAuthService(db: DbClient, mailer: Mailer) {
  return createAuthService({ store: createAuthStore(db), mailer, clock: systemClock });
}

/**
 * Wires the account data rights to Postgres and the system clock.
 *
 * @param db The shared database client.
 * @returns The account service.
 */
function provideAccountService(db: DbClient) {
  return createAccountService({ store: createAccountStore(db), clock: systemClock });
}

/** Auth and account routes, plus the global `SessionGuard` that protects every other route. */
@Module({
  controllers: [AuthController, AccountController],
  providers: [
    { provide: AUTH_SERVICE, inject: [DB_CLIENT, MAILER], useFactory: provideAuthService },
    { provide: ACCOUNT_SERVICE, inject: [DB_CLIENT], useFactory: provideAccountService },
    { provide: APP_GUARD, useClass: SessionGuard },
  ],
})
export class AuthModule {}
