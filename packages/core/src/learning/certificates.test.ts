import { beforeEach, describe, expect, it, vi } from "vitest";

import type { CourseCompleted } from "../events";
import { FakeCertificateRenderer, FakeCertificateStore } from "../test/certificate-fakes";
import { FakeObjectStorage } from "../test/media-fakes";
import { certificateName, createCertificateIssuer, createCertificateService, type CertificateIssuer } from "./certificates";
import { CertificateNotFoundError, CompletionNotFoundError } from "./errors";
import type { CourseCompletion } from "./ports";

const SCHOOL_ID = "school-1";
const COMPLETION: CourseCompletion = {
  student: { name: "សុខា ចាន់", email: "sokha@example.com" },
  courseTitle: "Brand Design",
  completedAt: new Date("2026-10-19T08:00:00Z"),
  school: { name: "Angkor Academy", subdomain: "angkor" },
  locale: "km",
};
const EVENT: CourseCompleted = { type: "CourseCompleted", schoolId: SCHOOL_ID, payload: { enrollmentId: "enr-1", courseId: "c-1" } };
const PDF_KEY = "schools/school-1/certificates/cert-enr-1.pdf";

let store: FakeCertificateStore;
let renderer: FakeCertificateRenderer;
let storage: FakeObjectStorage;
let askedSchools: string[];
let certificates: CertificateIssuer;

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
});

describe("issueForCompletion", () => {
  it("issues the certificate and stores its PDF under the school, with a verify link in the student's language", async () => {
    store.completions.set("enr-1", COMPLETION);

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

    expect(await createCertificateService(store).verifyCertificate("cert-enr-1")).toEqual({
      id: "cert-enr-1",
      studentName: "សុខា ចាន់",
      courseTitle: "Brand Design",
      schoolName: "Angkor Academy",
      issuedAt: COMPLETION.completedAt,
    });
  });

  it("throws when the school has no certificate with that id", async () => {
    await expect(createCertificateService(store).verifyCertificate("cert-missing")).rejects.toThrow(CertificateNotFoundError);
  });
});
