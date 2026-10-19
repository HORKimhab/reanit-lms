import { describe, expect, it } from "vitest";

import { composeMagicLinkEmail } from "./magic-link-email";

const OPTIONS = { appUrl: "http://localhost:3000", token: "tok en/1", next: "/courses?tab=all", locale: "en" as const };

describe("composeMagicLinkEmail", () => {
  it("links to the verify route on the web origin with the token and next path encoded", () => {
    const { text } = composeMagicLinkEmail(OPTIONS);

    expect(text).toContain("http://localhost:3000/api/auth/magic-link/verify?token=tok+en%2F1&next=%2Fcourses%3Ftab%3Dall");
  });

  it("says how many minutes the link lasts", () => {
    expect(composeMagicLinkEmail(OPTIONS).text).toContain("expires in 15 minutes");
  });

  it("writes the email in Khmer for the km locale", () => {
    const { subject, text } = composeMagicLinkEmail({ ...OPTIONS, locale: "km" });

    expect(subject).toBe("តំណចូលគណនីរបស់អ្នក");
    expect(text).toContain("15 នាទី");
    expect(text).toContain("http://localhost:3000/api/auth/magic-link/verify?");
  });
});
