// @vitest-environment node
import { createTransport } from "nodemailer";
import { describe, expect, it, vi } from "vitest";

import { createSmtpMailer } from "./mailer";

// SMTP is a network boundary: record what would be sent.
const sendMail = vi.fn();
vi.mock("nodemailer", () => ({ createTransport: vi.fn(() => ({ sendMail })) }));

describe("createSmtpMailer", () => {
  it("connects to the given SMTP URL", () => {
    createSmtpMailer("smtp://localhost:1025", "Reanit <no-reply@reanit.test>");

    expect(createTransport).toHaveBeenCalledWith("smtp://localhost:1025");
  });

  it("sends the message from the configured sender", async () => {
    const mailer = createSmtpMailer("smtp://localhost:1025", "Reanit <no-reply@reanit.test>");

    await mailer.send({ to: "dara@example.com", subject: "Hi", text: "Body" });

    expect(sendMail).toHaveBeenCalledWith({
      from: "Reanit <no-reply@reanit.test>",
      to: "dara@example.com",
      subject: "Hi",
      text: "Body",
    });
  });

  it("rejects when the SMTP server refuses the message", async () => {
    sendMail.mockRejectedValueOnce(new Error("550 rejected"));
    const mailer = createSmtpMailer("smtp://localhost:1025", "Reanit <no-reply@reanit.test>");

    await expect(mailer.send({ to: "dara@example.com", subject: "Hi", text: "Body" })).rejects.toThrow("550 rejected");
  });
});
