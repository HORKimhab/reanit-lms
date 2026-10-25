import type { CertificateDocument } from "@reanit/core/learning";
import { describe, expect, it } from "vitest";

import { pdfCertificateRenderer } from "./pdf-renderer";

const DOCUMENT: CertificateDocument = {
  studentName: "សុខា ចាន់",
  courseTitle: "ការរចនាម៉ាកយីហោ",
  schoolName: "Angkor Academy",
  issuedAt: new Date("2026-10-19T08:00:00Z"),
  locale: "km",
  verifyUrl: "https://reanit.com/km/s/angkor/certificates/6a1d3c2b-4e5f-4a6b-8c7d-9e0f1a2b3c4d",
};

/**
 * Renders a certificate and reads the PDF's bytes as Latin-1, so its plain-text structure can be searched.
 *
 * @param document What the certificate says.
 * @returns The PDF's source.
 */
async function renderSource(document: CertificateDocument) {
  return Buffer.from(await pdfCertificateRenderer.render(document)).toString("latin1");
}

describe("pdfCertificateRenderer", () => {
  it("draws a one-page PDF whose verify link can be clicked", async () => {
    const source = await renderSource(DOCUMENT);

    expect(source.startsWith("%PDF-")).toBe(true);
    expect(source.match(/\/Type \/Page\b/g)).toHaveLength(1);
    expect(source).toContain(`/URI (${DOCUMENT.verifyUrl})`);
  });

  it("embeds the Khmer and Latin font it writes in", async () => {
    const source = await renderSource(DOCUMENT);

    expect(source).toMatch(/\/BaseFont \/[A-Z]{6}\+KantumruyPro-Bold/);
    expect(source).toMatch(/\/BaseFont \/[A-Z]{6}\+KantumruyPro-Regular/);
  });

});
