import { Global, Module } from "@nestjs/common";
import type { Mailer } from "@reanit/core/auth";
import { createTransport } from "nodemailer";

import { ENV } from "@reanit/nest";

import type { Env } from "../config/env";

/** Injection token for the `Mailer` port from `@reanit/core`. */
export const MAILER = Symbol("MAILER");

/**
 * Sends email over SMTP (Mailpit locally).
 *
 * @param env Validated environment with the SMTP server and sender.
 * @returns A `Mailer` that sends plain-text messages from `MAIL_FROM`.
 */
export function createSmtpMailer(env: Pick<Env, "SMTP_URL" | "MAIL_FROM">): Mailer {
  const transport = createTransport(env.SMTP_URL);
  return {
    /**
     * Sends one message.
     *
     * @param message Recipient, subject and body.
     */
    async send(message) {
      await transport.sendMail({ from: env.MAIL_FROM, ...message });
    },
  };
}

/** Provides the SMTP mailer to every module. */
@Global()
@Module({
  providers: [{ provide: MAILER, inject: [ENV], useFactory: createSmtpMailer }],
  exports: [MAILER],
})
export class MailModule {}
