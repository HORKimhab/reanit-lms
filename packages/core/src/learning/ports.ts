import type { LessonType } from "../catalog";
import type { EmailLocale } from "../notifications";
import type { CommentThread, InboxThread, LessonComment } from "./comments";
import type { LessonUnlock } from "./drip";
import type { Quiz, QuizAnswers, QuizResult } from "./quizzes";

/** A student's access to one course. */
export interface Enrollment {
  id: string;
  courseId: string;
  /** Null for lifetime access. */
  expiresAt: Date | null;
  /** When the student got the course; drip lessons count from it. */
  enrolledAt: Date;
}

/** Where a student is in one lesson. */
export interface LessonProgress {
  lessonId: string;
  /** Where the video was last playing; 0 for other lessons. */
  positionSeconds: number;
  isCompleted: boolean;
}

/** What a heartbeat or "complete" saves; an omitted field keeps its stored value, and a completed lesson stays completed. */
export interface ProgressUpdate {
  positionSeconds?: number;
  completed?: boolean;
}

/** One school's enrollments and lesson progress. `@reanit/db` implements it with `createLearningStore`. */
export interface LearningStore {
  findEnrollment(userId: string, courseId: string): Promise<Enrollment | null>;
  /** The enrollment in the course the lesson belongs to; null when there is none or no such lesson. */
  findEnrollmentForLesson(userId: string, lessonId: string): Promise<Enrollment | null>;
  /** The lesson's drip settings; null when the school has no such lesson. */
  findLessonUnlock(lessonId: string): Promise<LessonUnlock | null>;
  listProgress(enrollmentId: string): Promise<LessonProgress[]>;
  saveProgress(enrollmentId: string, lessonId: string, update: ProgressUpdate): Promise<void>;
  /** Lessons the course has, and how many of them the enrollment completed. */
  countLessons(enrollmentId: string, courseId: string): Promise<{ completed: number; total: number }>;
  /**
   * Marks the enrollment's course completed and counts it in the day's completions, once:
   * a repeat for an enrollment already completed changes nothing.
   */
  completeCourse(enrollment: Enrollment, at: Date): Promise<void>;
}

/** A student's latest go at a quiz. */
export interface QuizAttemptSummary {
  scorePercent: number;
  isPassed: boolean;
  at: Date;
}

/** One school's quizzes and attempts. `@reanit/db` implements it with `createQuizStore`. */
export interface QuizStore {
  /** Null when the school has no such lesson. */
  findLessonType(lessonId: string): Promise<LessonType | null>;
  /** Null until the lesson's quiz is first saved. */
  findQuiz(lessonId: string): Promise<Quiz | null>;
  saveQuiz(lessonId: string, quiz: Quiz): Promise<void>;
  recordAttempt(attempt: { enrollmentId: string; lessonId: string; answers: QuizAnswers; result: QuizResult; at: Date }): Promise<void>;
  /** The enrollment's most recent attempt at the lesson's quiz, or null before the first. */
  findLastAttempt(enrollmentId: string, lessonId: string): Promise<QuizAttemptSummary | null>;
}

/** One school's lesson comments. `@reanit/db` implements it with `createCommentStore`. */
export interface CommentStore {
  /** Threads newest first, replies oldest first; hidden threads and replies only when asked for. */
  listThreads(lessonId: string, options: { includeHidden: boolean }): Promise<CommentThread[]>;
  /** Where a comment sits; null when the school has no such comment. */
  findComment(commentId: string): Promise<{ id: string; lessonId: string; authorId: string | null; parentId: string | null } | null>;
  createComment(comment: { lessonId: string; authorId: string; parentId: string | null; body: string; at: Date }): Promise<LessonComment>;
  /** Removes a comment and its replies. */
  deleteComment(commentId: string): Promise<void>;
  /** Returns false when the school has no such comment. */
  setHidden(commentId: string, isHidden: boolean): Promise<boolean>;
  /** Threads newest first, all or only those without a staff reply, hidden ones included. */
  listInbox(query: { isUnansweredOnly: boolean; limit: number; offset: number }): Promise<{ threads: InboxThread[]; total: number }>;
}

/** A completed enrollment, as its certificate is issued from. */
export interface CourseCompletion {
  student: { name: string | null; email: string };
  courseTitle: string;
  completedAt: Date;
  /** The school, with the `#rrggbb` brand color its certificates are drawn in (null for the default). */
  school: { name: string; subdomain: string; brandColor: string | null };
  /** The language the student bought the course in; English when they were enrolled without an order. */
  locale: EmailLocale;
}

/** A certificate as its holder's name and course title were when it was issued, before its PDF is stored. */
export interface IssuedCertificate {
  id: string;
  studentName: string;
  courseTitle: string;
  issuedAt: Date;
  /** Storage key of its PDF; null until the PDF is stored. */
  pdfKey: string | null;
}

/** A certificate as its public verify page shows it. */
export interface Certificate {
  id: string;
  studentName: string;
  courseTitle: string;
  schoolName: string;
  issuedAt: Date;
}

/** Who signs a school's certificates; null fields are left off the PDF. */
export interface CertificateTemplate {
  signerName: string | null;
  signerTitle: string | null;
}

/** One school's course certificates. `@reanit/db` implements it with `createCertificateStore`. */
export interface CertificateStore {
  /** Null when the school has no enrollment with that id, or it is not completed. */
  findCompletion(enrollmentId: string): Promise<CourseCompletion | null>;
  /** Creates the enrollment's certificate, or returns the one it already has, unchanged. */
  issue(certificate: { enrollmentId: string; studentName: string; courseTitle: string; issuedAt: Date }): Promise<IssuedCertificate>;
  setPdfKey(certificateId: string, pdfKey: string): Promise<void>;
  /** Null when the school has no certificate with that id. */
  findCertificate(certificateId: string): Promise<Certificate | null>;
  /** Storage key of the student's certificate PDF for the course; null when there is none yet. */
  findPdfKey(userId: string, courseSlug: string): Promise<string | null>;
  /** The school's template; blank when staff never saved one. */
  findTemplate(): Promise<CertificateTemplate>;
  saveTemplate(template: CertificateTemplate): Promise<void>;
}

/** What a certificate PDF shows. */
export interface CertificateDocument {
  studentName: string;
  courseTitle: string;
  schoolName: string;
  issuedAt: Date;
  /** The language of its labels and date. */
  locale: EmailLocale;
  /** Public page that confirms the certificate is real. */
  verifyUrl: string;
  /** The school's `#rrggbb` brand color, or the platform default. */
  accentColor: string;
  signer: CertificateTemplate;
}

/** Draws certificate PDFs. The worker implements it with PDFKit; tests use a fake. */
export interface CertificateRenderer {
  render(document: CertificateDocument): Promise<Uint8Array>;
}
