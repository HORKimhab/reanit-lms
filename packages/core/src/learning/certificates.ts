import { z } from "zod";

import type { CourseCompleted } from "../events";
import type { ObjectStorage } from "../media";
import { schoolPageUrl } from "../notifications";
import { CertificateNotFoundError, CompletionNotFoundError } from "./errors";
import type { Certificate, CertificateRenderer, CertificateStore, CourseCompletion } from "./ports";

/** Content type certificates are stored under. */
const PDF_CONTENT_TYPE = "application/pdf";

/** A certificate id from a verify URL: the certificate's UUID, unguessable, so only its holder can share it. */
export const certificateIdSchema = z.uuid();

/**
 * The name a certificate is made out to: the student's name, or the part of their email before the `@`
 * when they never gave one, so a certificate never shows a full address on its public page.
 *
 * @param student The student.
 * @param student.name Their name, if they gave one.
 * @param student.email Their email.
 * @returns The name to print.
 * @example
 * certificateName({ name: null, email: "sokha@example.com" }); // "sokha"
 */
export function certificateName({ name, email }: CourseCompletion["student"]): string {
  return name?.trim() || email.replace(/@.*$/, "");
}

/**
 * Where a certificate's PDF lives in the bucket; the school is part of it so keys never cross tenants.
 *
 * @param schoolId The school's id.
 * @param certificateId The certificate's id.
 * @returns The key, e.g. "schools/<school>/certificates/<certificate>.pdf".
 */
function certificatePdfKey(schoolId: string, certificateId: string): string {
  return `schools/${schoolId}/certificates/${certificateId}.pdf`;
}

/** What `createCertificateIssuer` needs. */
export interface CertificateIssuerDependencies {
  /** Builds one school's certificate store; events name their school. */
  certificatesFor: (schoolId: string) => CertificateStore;
  renderer: CertificateRenderer;
  storage: ObjectStorage;
  /** Public origin of the web app, for the verify link printed on the PDF. */
  appUrl: string;
}

/**
 * Builds the worker side of certificates: one per completed enrollment, with its PDF in object storage.
 *
 * @param dependencies Certificate stores, renderer, storage and the web app's origin.
 * @param dependencies.certificatesFor Builds one school's certificate store.
 * @param dependencies.renderer Draws the PDF.
 * @param dependencies.storage Stores it.
 * @param dependencies.appUrl Public origin of the web app.
 * @returns The certificate operations.
 * @example
 * const certificates = createCertificateIssuer({ certificatesFor, renderer, storage, appUrl: env.APP_URL });
 * await certificates.issueForCompletion(event);
 */
export function createCertificateIssuer({ certificatesFor, renderer, storage, appUrl }: CertificateIssuerDependencies) {
  return {
    /**
     * Issues the completed enrollment's certificate and stores its PDF, exactly once: the certificate is
     * created on the first run, and a repeat (a retried or twice-relayed event) only finishes a PDF that
     * was not stored yet. The PDF prints the name and title as they were at completion.
     *
     * @param event The `CourseCompleted` event.
     * @param event.schoolId The school the course belongs to.
     * @param event.payload The completed enrollment.
     * @throws {CompletionNotFoundError} When the school has no completed enrollment with the event's id.
     */
    async issueForCompletion({ schoolId, payload }: CourseCompleted): Promise<void> {
      const store = certificatesFor(schoolId);
      const completion = await store.findCompletion(payload.enrollmentId);
      if (!completion) throw new CompletionNotFoundError();
      const certificate = await store.issue({
        enrollmentId: payload.enrollmentId,
        studentName: certificateName(completion.student),
        courseTitle: completion.courseTitle,
        issuedAt: completion.completedAt,
      });
      if (certificate.pdfKey) return;

      const { locale, school } = completion;
      const pdf = await renderer.render({
        studentName: certificate.studentName,
        courseTitle: certificate.courseTitle,
        schoolName: school.name,
        issuedAt: certificate.issuedAt,
        locale,
        verifyUrl: schoolPageUrl({ appUrl, locale, subdomain: school.subdomain, path: `/certificates/${certificate.id}` }),
      });
      const key = certificatePdfKey(schoolId, certificate.id);
      await storage.put({ key, contentType: PDF_CONTENT_TYPE, body: pdf });
      await store.setPdfKey(certificate.id, key);
    },
  };
}

/** The certificate use cases the worker runs. */
export type CertificateIssuer = ReturnType<typeof createCertificateIssuer>;

/**
 * Builds the public side of one school's certificates: confirming that one is real.
 *
 * @param store The school's certificate store.
 * @returns The certificate operations.
 * @example
 * const certificate = await createCertificateService(createCertificateStore(db, school.id)).verifyCertificate(certificateId);
 */
export function createCertificateService(store: CertificateStore) {
  return {
    /**
     * Looks up a certificate for its verify page.
     *
     * @param certificateId The id from the verify URL.
     * @returns The certificate.
     * @throws {CertificateNotFoundError} When the school has no certificate with that id.
     */
    async verifyCertificate(certificateId: string): Promise<Certificate> {
      const certificate = await store.findCertificate(certificateId);
      if (!certificate) throw new CertificateNotFoundError();
      return certificate;
    },
  };
}

/** The certificate use cases of the school site. */
export type CertificateService = ReturnType<typeof createCertificateService>;
