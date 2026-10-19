import { createAuthService, type AuthService, type Clock } from "@reanit/core/auth";
import { createAuthStore } from "@reanit/db";

import { getDb } from "../db";
import { getServerEnv } from "../env";
import { createSmtpMailer } from "../mailer";

const systemClock: Clock = {
  /**
   * Reads the system time.
   *
   * @returns The current time.
   */
  now: () => new Date(),
};

let service: AuthService | undefined;

/**
 * Wires the auth use cases to Postgres, SMTP and the system clock.
 *
 * @returns The shared auth service.
 * @throws {z.ZodError} When the server environment is invalid.
 */
export function getAuthService(): AuthService {
  if (!service) {
    const { SMTP_URL, MAIL_FROM } = getServerEnv();
    service = createAuthService({
      store: createAuthStore(getDb()),
      mailer: createSmtpMailer(SMTP_URL, MAIL_FROM),
      clock: systemClock,
    });
  }
  return service;
}
