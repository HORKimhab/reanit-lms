import { randomUUID } from "node:crypto";

import { afterAll, beforeAll, describe, expect, inject, it } from "vitest";

import { createCatalogStore, createCertificateStore, createDbClient } from "../src";
import { enrollTestStudent, openTestSchool } from "../src/test/schools";

const db = createDbClient(inject("databaseUrl"));
const COMPLETED_AT = new Date("2026-10-20T01:00:00Z");
let alphaId: string;
let betaId: string;
let courseId: string;
let enrollmentId: string;

/**
 * Enrolls a new student in the test course and completes it.
 *
 * @param email The student's unique email.
 * @returns The enrollment's id and the student's.
 */
async function completeTestCourse(email: string) {
  const enrolled = await enrollTestStudent(db, { schoolId: alphaId, courseId }, email);
  await db.enrollment.update({ where: { id: enrolled.enrollmentId }, data: { completedAt: COMPLETED_AT } });
  return enrolled;
}

/**
 * Issues an enrollment's certificate in the alpha school.
 *
 * @param certifiedId The completed enrollment.
 * @param studentName The name to print.
 * @returns The stored certificate.
 */
function issueCertificate(certifiedId: string, studentName = "Sokha") {
  return createCertificateStore(db, alphaId).issue({ enrollmentId: certifiedId, studentName, courseTitle: "Certified", issuedAt: COMPLETED_AT });
}

beforeAll(async () => {
  alphaId = await openTestSchool(db, "certificates-alpha");
  betaId = await openTestSchool(db, "certificates-beta");
  courseId = (await createCatalogStore(db, alphaId).createCourse({ title: "Certified", slug: "certified" })).id;
  ({ enrollmentId } = await completeTestCourse("certificates-student@example.com"));
});

afterAll(async () => {
  await db.$disconnect();
});

describe("certificate store", () => {
  it("finds no completion for an enrollment not completed yet, from another school, or for an unknown id", async () => {
    const { enrollmentId: ongoingId } = await enrollTestStudent(db, { schoolId: alphaId, courseId }, "certificates-ongoing@example.com");

    expect(await createCertificateStore(db, alphaId).findCompletion(ongoingId)).toBeNull();
    expect(await createCertificateStore(db, betaId).findCompletion(enrollmentId)).toBeNull();
    expect(await createCertificateStore(db, alphaId).findCompletion(randomUUID())).toBeNull();
  });

  it("reads a completion in English when the student was enrolled without an order", async () => {
    expect(await createCertificateStore(db, alphaId).findCompletion(enrollmentId)).toEqual({
      student: { name: null, email: "certificates-student@example.com" },
      courseTitle: "Certified",
      completedAt: COMPLETED_AT,
      school: { name: "certificates-alpha", subdomain: "certificates-alpha", brandColor: null },
      locale: "en",
      subscriptionId: null,
    });
  });

  it("reads a completion in the language the student checked out in", async () => {
    const buyer = await completeTestCourse("certificates-buyer@example.com");
    const order = await db.order.create({
      data: { schoolId: alphaId, userId: buyer.studentId, status: "paid", totalAmount: 0, currency: "USD", paymentMethod: "stripe", locale: "km" },
    });
    await db.enrollment.update({ where: { id: buyer.enrollmentId }, data: { orderId: order.id } });

    expect((await createCertificateStore(db, alphaId).findCompletion(buyer.enrollmentId))?.locale).toBe("km");
  });

  it("issues one certificate per enrollment, returning the first unchanged when issued again", async () => {
    const first = await issueCertificate(enrollmentId);

    const again = await issueCertificate(enrollmentId, "Renamed");

    expect(first).toEqual({ id: expect.any(String), studentName: "Sokha", courseTitle: "Certified", issuedAt: COMPLETED_AT, pdfKey: null });
    expect(again).toEqual(first);
  });

  it("records the PDF's key, seen when issuing again", async () => {
    const certified = await completeTestCourse("certificates-pdf@example.com");
    const { id } = await issueCertificate(certified.enrollmentId);

    await createCertificateStore(db, alphaId).setPdfKey(id, `schools/${alphaId}/certificates/${id}.pdf`);

    expect((await issueCertificate(certified.enrollmentId)).pdfKey).toBe(`schools/${alphaId}/certificates/${id}.pdf`);
  });

  it("finds a certificate with its school's name, never from another school", async () => {
    const { id } = await issueCertificate((await completeTestCourse("certificates-verified@example.com")).enrollmentId);

    expect(await createCertificateStore(db, alphaId).findCertificate(id)).toEqual({
      id,
      studentName: "Sokha",
      courseTitle: "Certified",
      schoolName: "certificates-alpha",
      issuedAt: COMPLETED_AT,
    });
    expect(await createCertificateStore(db, betaId).findCertificate(id)).toBeNull();
    expect(await createCertificateStore(db, alphaId).findCertificate(randomUUID())).toBeNull();
  });

  it("cannot record another school's PDF key", async () => {
    const certified = await completeTestCourse("certificates-guarded@example.com");
    const { id } = await issueCertificate(certified.enrollmentId);

    await createCertificateStore(db, betaId).setPdfKey(id, "schools/beta/certificates/stolen.pdf");

    expect((await issueCertificate(certified.enrollmentId)).pdfKey).toBeNull();
  });

  it("finds a student's certificate PDF by course once it is stored, never another student's or school's", async () => {
    const certified = await completeTestCourse("certificates-download@example.com");
    const { id } = await issueCertificate(certified.enrollmentId);
    const store = createCertificateStore(db, alphaId);
    expect(await store.findPdfKey(certified.studentId, "certified")).toBeNull();

    await store.setPdfKey(id, `schools/${alphaId}/certificates/${id}.pdf`);

    expect(await store.findPdfKey(certified.studentId, "certified")).toBe(`schools/${alphaId}/certificates/${id}.pdf`);
    expect(await store.findPdfKey(certified.studentId, "other-course")).toBeNull();
    expect(await store.findPdfKey(randomUUID(), "certified")).toBeNull();
    expect(await createCertificateStore(db, betaId).findPdfKey(certified.studentId, "certified")).toBeNull();
  });

  it("keeps a blank template until staff save one, and each school's apart", async () => {
    const alpha = createCertificateStore(db, alphaId);
    expect(await alpha.findTemplate()).toEqual({ signerName: null, signerTitle: null });

    await alpha.saveTemplate({ signerName: "Dara Kim", signerTitle: "Founder" });
    await alpha.saveTemplate({ signerName: "Dara Kim", signerTitle: null });

    expect(await alpha.findTemplate()).toEqual({ signerName: "Dara Kim", signerTitle: null });
    expect(await createCertificateStore(db, betaId).findTemplate()).toEqual({ signerName: null, signerTitle: null });
  });
});
