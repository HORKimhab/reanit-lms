import { createTransport } from "nodemailer";
import { describe, expect, it, vi } from "vitest";

import { createSmtpMailer } from "./mail";

// SMTP is a network boundary: record what would be sent.
const sendMail = vi.fn();
vi.mock("nodemailer", () => ({ createTransport: vi.fn(() => ({ sendMail })) }));

const SMTP = { SMTP_URL: "smtp://localhost:1025", MAIL_FROM: "Reanit <no-reply@reanit.test>" };
const MESSAGE = { to: "dara@example.com", subject: "Hi", text: "Body", html: "<p>Body</p>" };

describe("createSmtpMailer", () => {
  it("connects to the configured SMTP URL", () => {
    createSmtpMailer(SMTP);

    expect(createTransport).toHaveBeenCalledWith("smtp://localhost:1025");
  });

  it("sends the message, both bodies included, from the configured sender", async () => {
    await createSmtpMailer(SMTP).send(MESSAGE);

    expect(sendMail).toHaveBeenCalledWith({ from: "Reanit <no-reply@reanit.test>", ...MESSAGE });
  });

  it("adds a List-Unsubscribe header for a message that can be turned off", async () => {
    await createSmtpMailer(SMTP).send({ ...MESSAGE, unsubscribeUrl: "https://reanit.test/unsubscribe?token=t" });

    expect(sendMail).toHaveBeenCalledWith({ from: "Reanit <no-reply@reanit.test>", ...MESSAGE, list: { unsubscribe: "https://reanit.test/unsubscribe?token=t" } });
  });

  it("rejects when the SMTP server refuses the message", async () => {
    sendMail.mockRejectedValueOnce(new Error("550 rejected"));

    await expect(createSmtpMailer(SMTP).send(MESSAGE)).rejects.toThrow("550 rejected");
  });
});
