// In-memory fakes of the certificate ports, for unit tests of issuing and verifying certificates.
import type {
  Certificate,
  CertificateDocument,
  CertificateRenderer,
  CertificateStore,
  CertificateTemplate,
  CourseCompletion,
  IssuedCertificate,
} from "../learning/ports";

/** In-memory `CertificateStore` for one school, whose certificates tests can inspect. */
export class FakeCertificateStore implements CertificateStore {
  /** Completed enrollments by id. */
  readonly completions = new Map<string, CourseCompletion>();
  /** Issued certificates by enrollment id. */
  readonly certificates = new Map<string, IssuedCertificate>();
  /** Enrollment ids by `<user id>:<course slug>`, for students' downloads. */
  readonly enrollments = new Map<string, string>();
  /** The school's name, as verified certificates show it. */
  schoolName = "Angkor Academy";
  template: CertificateTemplate = { signerName: null, signerTitle: null };

  /**
   * Finds a completed enrollment.
   *
   * @param enrollmentId The enrollment.
   * @returns The completion, or null.
   */
  async findCompletion(enrollmentId: string) {
    return this.completions.get(enrollmentId) ?? null;
  }

  /**
   * Creates the enrollment's certificate with an id derived from it, or returns the existing one.
   *
   * @param certificate What to issue.
   * @param certificate.enrollmentId The completed enrollment.
   * @param certificate.studentName The name to print.
   * @param certificate.courseTitle The course to print.
   * @param certificate.issuedAt When it was earned.
   * @returns The stored certificate.
   */
  async issue({ enrollmentId, ...details }: { enrollmentId: string; studentName: string; courseTitle: string; issuedAt: Date }) {
    const existing = this.certificates.get(enrollmentId);
    if (existing) return existing;
    const certificate = { id: `cert-${enrollmentId}`, ...details, pdfKey: null };
    this.certificates.set(enrollmentId, certificate);
    return certificate;
  }

  /**
   * Records where a certificate's PDF is.
   *
   * @param certificateId The certificate.
   * @param pdfKey The PDF's storage key.
   */
  async setPdfKey(certificateId: string, pdfKey: string) {
    for (const [enrollmentId, certificate] of this.certificates) {
      if (certificate.id === certificateId) this.certificates.set(enrollmentId, { ...certificate, pdfKey });
    }
  }

  /**
   * Finds an issued certificate by its id.
   *
   * @param certificateId The certificate.
   * @returns It with the school's name, or null.
   */
  async findCertificate(certificateId: string): Promise<Certificate | null> {
    const certificate = [...this.certificates.values()].find(({ id }) => id === certificateId);
    if (!certificate) return null;
    const { id, studentName, courseTitle, issuedAt } = certificate;
    return { id, studentName, courseTitle, schoolName: this.schoolName, issuedAt };
  }

  /**
   * Finds the PDF of a student's certificate for a course.
   *
   * @param userId The student.
   * @param courseSlug The course.
   * @returns The PDF's key, or null.
   */
  async findPdfKey(userId: string, courseSlug: string) {
    const enrollmentId = this.enrollments.get(`${userId}:${courseSlug}`);
    return (enrollmentId && this.certificates.get(enrollmentId)?.pdfKey) || null;
  }

  /**
   * Reads the school's template.
   *
   * @returns The template.
   */
  async findTemplate() {
    return this.template;
  }

  /**
   * Replaces the school's template.
   *
   * @param template The new template.
   */
  async saveTemplate(template: CertificateTemplate) {
    this.template = template;
  }
}

/** Renderer whose "PDF" is the JSON of what it was asked to draw, so tests can read it back. */
export class FakeCertificateRenderer implements CertificateRenderer {
  readonly rendered: CertificateDocument[] = [];

  /**
   * Records the document and encodes it.
   *
   * @param document What to draw.
   * @returns The document as UTF-8 JSON.
   */
  async render(document: CertificateDocument) {
    this.rendered.push(document);
    return new TextEncoder().encode(JSON.stringify(document));
  }
}
