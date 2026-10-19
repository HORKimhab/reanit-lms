import type { Mailer } from "@reanit/core/auth";
import { createTransport } from "nodemailer";

/**
 * Sends email over SMTP (Mailpit locally).
 *
 * @param smtpUrl SMTP server URL.
 * @param from Sender address for every message.
 * @returns A `Mailer` for the auth service.
 */
export function createSmtpMailer(smtpUrl: string, from: string): Mailer {
  const transport = createTransport(smtpUrl);
  return {
    /**
     * Sends one plain-text message.
     *
     * @param message Recipient, subject and body.
     */
    async send(message) {
      await transport.sendMail({ from, ...message });
    },
  };
}
