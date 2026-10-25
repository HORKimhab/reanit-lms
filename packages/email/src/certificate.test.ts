import { describe, expect, it } from "vitest";

import { certificateText } from "./certificate";

const ISSUED_AT = new Date("2026-10-19T20:00:00Z");

describe("certificateText", () => {
  it("writes the certificate in English with the date in Phnom Penh time", () => {
    expect(certificateText({ locale: "en", schoolName: "Angkor Academy", issuedAt: ISSUED_AT })).toEqual({
      title: "Certificate of Completion",
      presentedTo: "This certifies that",
      completed: "has completed the course",
      issued: "Issued by Angkor Academy on October 20, 2026",
      verify: "Verify this certificate at",
    });
  });

  it("writes the certificate in Khmer for km", () => {
    const text = certificateText({ locale: "km", schoolName: "Angkor Academy", issuedAt: ISSUED_AT });

    expect(text.title).toBe("វិញ្ញាបនបត្របញ្ចប់វគ្គសិក្សា");
    expect(text.issued).toBe("ចេញដោយ Angkor Academy នៅថ្ងៃទី 20 តុលា 2026");
  });
});
