import { beforeEach, describe, expect, it, vi } from "vitest";

import type { CourseCompleted } from "../events";
import { DEFAULT_BRAND_COLOR } from "../schools";
import { FakeClock } from "../test/auth-fakes";
import { FakeCertificateRenderer, FakeCertificateStore } from "../test/certificate-fakes";
import { FakeObjectStorage } from "../test/media-fakes";
import {
  certificateName,
  certificateTemplateSchema,
  createCertificateIssuer,
  createCertificateService,
  SIGNER_MAX_LENGTH,
  type CertificateIssuer,
  type CertificateService,
} from "./certificates";
import { CertificateNotFoundError, CompletionNotFoundError } from "./errors";
import type { CourseCompletion } from "./ports";

const SCHOOL_ID = "school-1";
const COMPLETION: CourseCompletion = {
  student: { name: "សុខា ចាន់", email: "sokha@example.com" },
  courseTitle: "Brand Design",
  completedAt: new Date("2026-10-19T08:00:00Z"),
  school: { name: "Angkor Academy", subdomain: "angkor", brandColor: "#0f766e" },
  locale: "km",
};
const NOW = new Date("2026-10-25T08:00:00Z");
const EVENT: CourseCompleted = { type: "CourseCompleted", schoolId: SCHOOL_ID, payload: { enrollmentId: "enr-1", courseId: "c-1" } };
const PDF_KEY = "schools/school-1/certificates/cert-enr-1.pdf";

let store: FakeCertificateStore;
let renderer: FakeCertificateRenderer;
let storage: FakeObjectStorage;
let askedSchools: string[];
let certificates: CertificateIssuer;
let service: CertificateService;

/**
 * Hands out the test's certificate store, recording which school asked.
 *
 * @param schoolId The event's school.
 * @returns The fake store.
 */
function certificatesFor(schoolId: string) {
  askedSchools.push(schoolId);
  return store;
}

beforeEach(() => {
  store = new FakeCertificateStore();
  renderer = new FakeCertificateRenderer();
  storage = new FakeObjectStorage();
  askedSchools = [];
  certificates = createCertificateIssuer({ certificatesFor, renderer, storage, appUrl: "https://reanit.com" });
  service = createCertificateService({ store, storage, clock: new FakeClock(NOW) });
});

describe("issueForCompletion", () => {
  it("issues the certificate and stores its PDF under the school, with a verify link in the student's language", async () => {
    store.completions.set("enr-1", COMPLETION);
    store.template = { signerName: "Dara Kim", signerTitle: "Founder" };

    await certificates.issueForCompletion(EVENT);

    expect(askedSchools).toEqual([SCHOOL_ID]);
    expect(renderer.rendered).toEqual([
      {
        studentName: "សុខា ចាន់",
        courseTitle: "Brand Design",
        schoolName: "Angkor Academy",
        issuedAt: COMPLETION.completedAt,
        locale: "km",
        verifyUrl: "https://reanit.com/km/s/angkor/certificates/cert-enr-1",
        accentColor: "#0f766e",
        signer: { signerName: "Dara Kim", signerTitle: "Founder" },
      },
    ]);
    expect(storage.stored.get(PDF_KEY)?.contentType).toBe("application/pdf");
    expect(store.certificates.get("enr-1")?.pdfKey).toBe(PDF_KEY);
  });

  it("links to the unprefixed English verify page for an English student", async () => {
    store.completions.set("enr-1", { ...COMPLETION, locale: "en" });

    await certificates.issueForCompletion(EVENT);

    expect(renderer.rendered[0]?.verifyUrl).toBe("https://reanit.com/s/angkor/certificates/cert-enr-1");
  });

  it("draws in the platform's default color, unsigned, for a school without a brand color or template", async () => {
    store.completions.set("enr-1", { ...COMPLETION, school: { ...COMPLETION.school, brandColor: null } });

    await certificates.issueForCompletion(EVENT);

    expect(renderer.rendered[0]).toMatchObject({ accentColor: DEFAULT_BRAND_COLOR, signer: { signerName: null, signerTitle: null } });
  });

  it("does nothing more when the event runs again after the PDF was stored", async () => {
    store.completions.set("enr-1", COMPLETION);
    await certificates.issueForCompletion(EVENT);

    await certificates.issueForCompletion(EVENT);

    expect(store.certificates.size).toBe(1);
    expect(renderer.rendered).toHaveLength(1);
  });

  it("finishes the PDF of a certificate issued by an earlier run, with the name and title it was issued with", async () => {
    store.completions.set("enr-1", { ...COMPLETION, courseTitle: "Brand Design 2", student: { ...COMPLETION.student, name: "Renamed" } });
    store.certificates.set("enr-1", { id: "cert-enr-1", studentName: "សុខា ចាន់", courseTitle: "Brand Design", issuedAt: COMPLETION.completedAt, pdfKey: null });

    await certificates.issueForCompletion(EVENT);

    expect(renderer.rendered[0]).toMatchObject({ studentName: "សុខា ចាន់", courseTitle: "Brand Design" });
    expect(store.certificates.get("enr-1")?.pdfKey).toBe(PDF_KEY);
  });

  it("throws and stores nothing when the school has no such completed enrollment", async () => {
    await expect(certificates.issueForCompletion(EVENT)).rejects.toThrow(CompletionNotFoundError);

    expect(store.certificates.size).toBe(0);
    expect(storage.stored.size).toBe(0);
  });

  it("leaves the certificate without a PDF when storing it fails, so a retry finishes it", async () => {
    store.completions.set("enr-1", COMPLETION);
    vi.spyOn(storage, "put").mockRejectedValue(new Error("storage down"));

    await expect(certificates.issueForCompletion(EVENT)).rejects.toThrow("storage down");

    expect(store.certificates.get("enr-1")?.pdfKey).toBeNull();
  });
});

describe("certificateName", () => {
  it("uses the student's name, trimmed", () => {
    expect(certificateName({ name: "  Sokha Chan ", email: "sokha@example.com" })).toBe("Sokha Chan");
  });

  it("falls back to the email's local part when the student gave no name", () => {
    expect(certificateName({ name: null, email: "sokha.chan@example.com" })).toBe("sokha.chan");
  });

  it("falls back to the email's local part when the name is blank", () => {
    expect(certificateName({ name: "   ", email: "dara@example.com" })).toBe("dara");
  });
});

describe("verifyCertificate", () => {
  it("returns an issued certificate with its school", async () => {
    store.completions.set("enr-1", COMPLETION);
    await certificates.issueForCompletion(EVENT);

    expect(await service.verifyCertificate("cert-enr-1")).toEqual({
      id: "cert-enr-1",
      studentName: "សុខា ចាន់",
      courseTitle: "Brand Design",
      schoolName: "Angkor Academy",
      issuedAt: COMPLETION.completedAt,
    });
  });

  it("throws when the school has no certificate with that id", async () => {
    await expect(service.verifyCertificate("cert-missing")).rejects.toThrow(CertificateNotFoundError);
  });
});

describe("getDownloadUrl", () => {
  it("signs a short-lived link to the student's certificate PDF", async () => {
    store.completions.set("enr-1", COMPLETION);
    store.enrollments.set("user-1:brand", "enr-1");
    await certificates.issueForCompletion(EVENT);

    expect(await service.getDownloadUrl("user-1", "brand")).toEqual({
      url: `https://storage.test/${PDF_KEY}?download&expires=300`,
      expiresAt: new Date("2026-10-25T08:05:00Z"),
    });
  });

  it("throws while the PDF is still being made", async () => {
    store.enrollments.set("user-1:brand", "enr-1");
    store.certificates.set("enr-1", { id: "cert-enr-1", studentName: "Sokha", courseTitle: "Brand", issuedAt: NOW, pdfKey: null });

    await expect(service.getDownloadUrl("user-1", "brand")).rejects.toThrow(CertificateNotFoundError);
  });

  it("throws when the student has no certificate for the course", async () => {
    await expect(service.getDownloadUrl("user-2", "brand")).rejects.toThrow(CertificateNotFoundError);
  });
});

describe("certificate template", () => {
  it("is blank until staff save one, then reads back what they saved", async () => {
    expect(await service.getTemplate()).toEqual({ signerName: null, signerTitle: null });

    await service.saveTemplate({ signerName: "Dara Kim", signerTitle: "Founder" });

    expect(await service.getTemplate()).toEqual({ signerName: "Dara Kim", signerTitle: "Founder" });
  });

  it("parses blank fields as null and trims the rest", () => {
    expect(certificateTemplateSchema.parse({ signerName: "  ដារ៉ា គីម ", signerTitle: "   " })).toEqual({ signerName: "ដារ៉ា គីម", signerTitle: null });
    expect(certificateTemplateSchema.parse({ signerName: null, signerTitle: null })).toEqual({ signerName: null, signerTitle: null });
  });

  it("rejects a signer line over the limit", () => {
    expect(certificateTemplateSchema.safeParse({ signerName: "a".repeat(SIGNER_MAX_LENGTH + 1), signerTitle: null }).success).toBe(false);
    expect(certificateTemplateSchema.safeParse({ signerName: "a".repeat(SIGNER_MAX_LENGTH), signerTitle: null }).success).toBe(true);
  });
});
