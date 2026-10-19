import { Global, Module } from "@nestjs/common";
import type { Mailer } from "@reanit/core/auth";
import { createTransport } from "nodemailer";
import { z } from "zod";

import { ENV } from "./env";

/** Injection token for the `Mailer` port from `@reanit/core`. */
export const MAILER = Symbol("MAILER");

/** Variables an app that sends email adds to its environment. */
export const mailEnvSchema = z.object({
  /** SMTP server, e.g. smtp://localhost:1025 for Mailpit. */
  SMTP_URL: z.url(),
  /** Sender of transactional email, e.g. `Reanit <no-reply@reanit.com>`. */
  MAIL_FROM: z.string().min(1),
});

/** The variables the mailer reads. */
type MailEnv = z.infer<typeof mailEnvSchema>;

/**
 * Sends email over SMTP (Mailpit locally).
 *
 * @param env Validated environment with the SMTP server and sender.
 * @returns A `Mailer` that sends from `MAIL_FROM`, with an HTML body when the message has one.
 */
export function createSmtpMailer(env: MailEnv): Mailer {
  const transport = createTransport(env.SMTP_URL);
  return {
    /**
     * Sends one message.
     *
     * @param message Recipient, subject and bodies.
     */
    async send(message) {
      await transport.sendMail({ from: env.MAIL_FROM, ...message });
    },
  };
}

/** Provides the SMTP mailer to every module; the app's environment must include `mailEnvSchema`. */
@Global()
@Module({
  providers: [{ provide: MAILER, inject: [ENV], useFactory: createSmtpMailer }],
  exports: [MAILER],
})
export class MailModule {}
