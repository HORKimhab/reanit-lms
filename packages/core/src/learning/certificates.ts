import { z } from "zod";

import type { Clock } from "../auth";
import type { CourseCompleted } from "../events";
import { createUploads, type ObjectStorage } from "../media";
import { schoolPageUrl } from "../notifications";
import { DEFAULT_BRAND_COLOR } from "../schools";
import { CertificateNotFoundError, CompletionNotFoundError } from "./errors";
import type { Certificate, CertificateRenderer, CertificateStore, CertificateTemplate, CourseCompletion } from "./ports";

/** Content type certificates are stored under. */
const PDF_CONTENT_TYPE = "application/pdf";
/** Longest signer name or title a template takes. */
export const SIGNER_MAX_LENGTH = 80;
/** How long a student's certificate download link works; the player opens it as soon as it is signed. */
const CERTIFICATE_URL_TTL_SECONDS = 5 * 60;

/** A certificate id from a verify URL: the certificate's UUID, unguessable, so only its holder can share it. */
export const certificateIdSchema = z.uuid();

/** An optional line of the signature block: trimmed, and null when left blank. */
const signerLineSchema = z
  .string()
  .trim()
  .max(SIGNER_MAX_LENGTH)
  .nullable()
  .transform((line) => line || null);

/** Certificate template form: who signs the school's certificates. Blank fields print no signature block. */
export const certificateTemplateSchema = z.object({ signerName: signerLineSchema, signerTitle: signerLineSchema });

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
     * was not stored yet. The PDF prints the name and title as they were at completion, in the school's
     * brand color, signed as its certificate template says.
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
        accentColor: school.brandColor ?? DEFAULT_BRAND_COLOR,
        signer: await store.findTemplate(),
      });
      const key = certificatePdfKey(schoolId, certificate.id);
      await storage.put({ key, contentType: PDF_CONTENT_TYPE, body: pdf });
      await store.setPdfKey(certificate.id, key);
    },
  };
}

/** The certificate use cases the worker runs. */
export type CertificateIssuer = ReturnType<typeof createCertificateIssuer>;

/** What `createCertificateService` needs. */
export interface CertificateServiceDependencies {
  /** The school's certificate store. */
  store: CertificateStore;
  /** Signs students' downloads. */
  storage: ObjectStorage;
  clock: Clock;
}

/**
 * Builds one school's certificate use cases on the web side: checking a certificate is real, the
 * student's download, and the staff's template.
 *
 * @param dependencies The school's store, storage and clock.
 * @param dependencies.store The school's certificate store.
 * @param dependencies.storage Signs downloads.
 * @param dependencies.clock Source of the current time, for when download links expire.
 * @returns The certificate operations.
 * @example
 * const certificates = createCertificateService({ store: createCertificateStore(db, school.id), storage, clock });
 * const certificate = await certificates.verifyCertificate(certificateId);
 */
export function createCertificateService({ store, storage, clock }: CertificateServiceDependencies) {
  const uploads = createUploads({ storage, clock });

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

    /**
     * Signs a link to the student's certificate PDF for a course.
     *
     * @param userId The signed-in student.
     * @param courseSlug The course.
     * @returns The URL and when it expires.
     * @throws {CertificateNotFoundError} When the student has no certificate for the course yet, or its PDF is still being made.
     */
    async getDownloadUrl(userId: string, courseSlug: string): Promise<{ url: string; expiresAt: Date }> {
      const pdfKey = await store.findPdfKey(userId, courseSlug);
      if (!pdfKey) throw new CertificateNotFoundError();
      return uploads.signDownload(pdfKey, CERTIFICATE_URL_TTL_SECONDS);
    },

    /**
     * Reads who signs the school's certificates.
     *
     * @returns The template; blank until staff save one.
     */
    getTemplate(): Promise<CertificateTemplate> {
      return store.findTemplate();
    },

    /**
     * Saves who signs the school's certificates; certificates issued from now on print it.
     *
     * @param template The parsed template form.
     * @returns The saved template.
     */
    async saveTemplate(template: CertificateTemplate): Promise<CertificateTemplate> {
      await store.saveTemplate(template);
      return template;
    },
  };
}

/** The certificate use cases of the school site and the dashboard. */
export type CertificateService = ReturnType<typeof createCertificateService>;
