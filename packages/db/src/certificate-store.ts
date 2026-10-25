import type { DbClient } from "./client";
import type { Prisma } from "./generated/prisma/client";
import { forSchool } from "./tenant";

/** Languages certificates are written in; matches `EmailLocale` in `@reanit/core/notifications`. */
type CertificateLocale = "en" | "km";

/** Language of a student enrolled without an order. */
const DEFAULT_LOCALE: CertificateLocale = "en";

/** A template's columns. */
const TEMPLATE_FIELDS = { signerName: true, signerTitle: true } satisfies Prisma.CertificateTemplateSelect;

/** The template of a school whose staff never saved one. */
const BLANK_TEMPLATE = { signerName: null, signerTitle: null };

/** An issued certificate's columns, as the worker reads them back. */
const ISSUED_FIELDS = { id: true, studentName: true, courseTitle: true, issuedAt: true, pdfKey: true } satisfies Prisma.CertificateSelect;

/**
 * One school's course certificates. Every query goes through the tenant client, so another school's
 * enrollments and certificates are invisible; it satisfies `CertificateStore` from `@reanit/core/learning`.
 *
 * @param db Unscoped client from `createDbClient`.
 * @param schoolId The school the certificates belong to.
 * @returns The store operations.
 * @throws {z.ZodError} When `schoolId` is not a UUID.
 * @example
 * createCertificateIssuer({ certificatesFor: (schoolId) => createCertificateStore(db, schoolId), renderer, storage, appUrl });
 */
export function createCertificateStore(db: DbClient, schoolId: string) {
  const tenant = forSchool(db, schoolId);

  return {
    /**
     * Loads a completed enrollment with its student, course and school (with its brand color), in the language the student bought it in.
     *
     * @param enrollmentId The enrollment.
     * @returns The completion, or null when the school has no such enrollment or it is not completed.
     */
    async findCompletion(enrollmentId: string) {
      const enrollment = await tenant.enrollment.findFirst({
        where: { id: enrollmentId, completedAt: { not: null } },
        select: {
          completedAt: true,
          user: { select: { name: true, email: true } },
          course: { select: { title: true } },
          school: { select: { name: true, subdomain: true, brandColor: true } },
          order: { select: { locale: true } },
        },
      });
      if (!enrollment?.completedAt) return null;
      return {
        student: enrollment.user,
        courseTitle: enrollment.course.title,
        completedAt: enrollment.completedAt,
        school: enrollment.school,
        locale: (enrollment.order?.locale ?? DEFAULT_LOCALE) as CertificateLocale,
      };
    },

    /**
     * Creates the enrollment's certificate, or returns the one it already has, unchanged.
     *
     * @param certificate What to issue.
     * @param certificate.enrollmentId The completed enrollment.
     * @param certificate.studentName The name to print.
     * @param certificate.courseTitle The course to print.
     * @param certificate.issuedAt When it was earned.
     * @returns The stored certificate.
     */
    issue({ enrollmentId, ...details }: { enrollmentId: string; studentName: string; courseTitle: string; issuedAt: Date }) {
      return tenant.certificate.upsert({
        where: { enrollmentId },
        create: { schoolId, enrollmentId, ...details },
        update: {},
        select: ISSUED_FIELDS,
      });
    },

    /**
     * Records where a certificate's PDF is stored.
     *
     * @param certificateId The certificate.
     * @param pdfKey The PDF's storage key.
     */
    async setPdfKey(certificateId: string, pdfKey: string) {
      await tenant.certificate.updateMany({ where: { id: certificateId }, data: { pdfKey } });
    },

    /**
     * Loads a certificate with its school's name, for the public verify page.
     *
     * @param certificateId The certificate.
     * @returns The certificate, or null when the school has none with that id.
     */
    async findCertificate(certificateId: string) {
      const certificate = await tenant.certificate.findFirst({
        where: { id: certificateId },
        select: { id: true, studentName: true, courseTitle: true, issuedAt: true, school: { select: { name: true } } },
      });
      if (!certificate) return null;
      const { school, ...details } = certificate;
      return { ...details, schoolName: school.name };
    },

    /**
     * Finds the PDF of a student's certificate for a course.
     *
     * @param userId The student.
     * @param courseSlug The course's slug.
     * @returns The PDF's storage key, or null when the student has no certificate for it yet or its PDF is not stored.
     */
    async findPdfKey(userId: string, courseSlug: string) {
      const certificate = await tenant.certificate.findFirst({
        where: { enrollment: { userId, course: { slug: courseSlug } } },
        select: { pdfKey: true },
      });
      return certificate?.pdfKey ?? null;
    },

    /**
     * Reads who signs the school's certificates.
     *
     * @returns The template; blank when staff never saved one.
     */
    async findTemplate() {
      return (await tenant.certificateTemplate.findFirst({ select: TEMPLATE_FIELDS })) ?? BLANK_TEMPLATE;
    },

    /**
     * Saves who signs the school's certificates.
     *
     * @param template The template.
     * @param template.signerName Who signs; null for no signature block.
     * @param template.signerTitle Their title; null to leave it off.
     */
    async saveTemplate(template: { signerName: string | null; signerTitle: string | null }) {
      await tenant.certificateTemplate.upsert({ where: { schoolId }, create: { schoolId, ...template }, update: template });
    },
  };
}
