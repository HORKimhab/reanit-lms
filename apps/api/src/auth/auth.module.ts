import { Module } from "@nestjs/common";
import { APP_GUARD } from "@nestjs/core";
import { createAuthService, type Clock, type Mailer } from "@reanit/core/auth";
import { createAuthStore, type DbClient } from "@reanit/db";

import { DB_CLIENT } from "@reanit/nest";
import { MAILER } from "../mail/mail.module";
import { AuthController } from "./auth.controller";
import { AUTH_SERVICE } from "./auth.tokens";
import { SessionGuard } from "./session.guard";

/** The real clock; tests replace the whole auth service instead. */
const systemClock: Clock = {
  /**
   * Reads the system time.
   *
   * @returns The current time.
   */
  now: () => new Date(),
};

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

/** Auth routes, plus the global `SessionGuard` that protects every other route. */
@Module({
  controllers: [AuthController],
  providers: [
    { provide: AUTH_SERVICE, inject: [DB_CLIENT, MAILER], useFactory: provideAuthService },
    { provide: APP_GUARD, useClass: SessionGuard },
  ],
})
export class AuthModule {}
