import { STATUS_CODES } from "node:http";

import { HttpException, HttpStatus } from "@nestjs/common";
import { ThrottlerException } from "@nestjs/throttler";
import { InvalidStatsRangeError } from "@reanit/core/analytics";
import { AccountRunsSchoolError, DeletionNotConfirmedError, EmailTakenError, InvalidCredentialsError, InvalidMagicLinkError } from "@reanit/core/auth";
import { CourseNotFoundError } from "@reanit/core/catalog";
import {
  AlreadyEnrolledError,
  BundleNotFoundError,
  CouponCodeTakenError,
  CouponNotFoundError,
  CourseNotForSaleError,
  InvalidCouponError,
  OrderNotFoundError,
  PaymentMethodUnavailableError,
  UnknownBundleCourseError,
} from "@reanit/core/commerce";
import {
  InvalidMediaKeyError,
  LessonMediaMissingError,
  LessonNotFoundError,
  MediaNotUploadedError,
  MediaTooLargeError,
  UnsupportedMediaError,
} from "@reanit/core/media";
import {
  CertificateNotFoundError,
  CommentNotFoundError,
  LessonLockedError,
  NotCommentAuthorError,
  NotEnrolledError,
  QuizNotFoundError,
} from "@reanit/core/learning";
import { InvalidUnsubscribeLinkError } from "@reanit/core/notifications";
import {
  CustomDomainsUnavailableError,
  DomainNotAllowedError,
  DomainNotFoundError,
  DomainNotVerifiedError,
  DomainTakenError,
  NotSchoolStaffError,
  SchoolHasDomainError,
  SchoolNotFoundError,
  SubdomainTakenError,
} from "@reanit/core/schools";

import { RequestValidationError } from "./zod-validation.pipe";

/** Media type of every error response (RFC 9457). */
export const PROBLEM_CONTENT_TYPE = "application/problem+json";

/** Prefix of the `type` of problems this API defines; clients branch on the full URI. */
const PROBLEM_TYPE_PREFIX = "urn:reanit:problem:";

/** An RFC 9457 problem details body. */
export interface Problem {
  /** URI naming the kind of problem; `about:blank` when the HTTP status says it all. */
  type: string;
  title: string;
  status: number;
  /** Explanation for this occurrence, safe to show the caller. */
  detail?: string;
  /** Invalid request fields, as JSON pointers into the request part. */
  errors?: { pointer: string; detail: string }[];
}

/** How a typed error from `@reanit/core` is answered. */
interface DomainProblem {
  error: abstract new (...args: never[]) => Error;
  status: HttpStatus;
  /** Last segment of the problem `type`. */
  code: string;
  detail: string;
}

const DOMAIN_PROBLEMS: DomainProblem[] = [
  { error: EmailTakenError, status: HttpStatus.CONFLICT, code: "email-taken", detail: "An account with this email already exists." },
  { error: InvalidCredentialsError, status: HttpStatus.UNAUTHORIZED, code: "invalid-credentials", detail: "The email or password is wrong." },
  { error: InvalidMagicLinkError, status: HttpStatus.BAD_REQUEST, code: "invalid-magic-link", detail: "The sign-in link is invalid, used or expired." },
  { error: DeletionNotConfirmedError, status: HttpStatus.BAD_REQUEST, code: "deletion-not-confirmed", detail: "Type your account's email to confirm deleting it." },
  { error: AccountRunsSchoolError, status: HttpStatus.CONFLICT, code: "account-runs-school", detail: "You help run a school. Leave its team before deleting your account." },
  { error: SubdomainTakenError, status: HttpStatus.CONFLICT, code: "subdomain-taken", detail: "Another school already uses this subdomain." },
  { error: NotSchoolStaffError, status: HttpStatus.FORBIDDEN, code: "not-school-staff", detail: "You do not run a school." },
  { error: SchoolNotFoundError, status: HttpStatus.NOT_FOUND, code: "school-not-found", detail: "No school uses this subdomain." },
  { error: CustomDomainsUnavailableError, status: HttpStatus.SERVICE_UNAVAILABLE, code: "custom-domains-unavailable", detail: "Custom domains are not offered here yet." },
  { error: DomainNotAllowedError, status: HttpStatus.BAD_REQUEST, code: "domain-not-allowed", detail: "This domain belongs to the platform; use your school's subdomain instead." },
  { error: DomainTakenError, status: HttpStatus.CONFLICT, code: "domain-taken", detail: "Another school has already verified this domain." },
  { error: SchoolHasDomainError, status: HttpStatus.CONFLICT, code: "school-has-domain", detail: "The school already has a custom domain. Remove it first." },
  { error: DomainNotFoundError, status: HttpStatus.NOT_FOUND, code: "domain-not-found", detail: "No custom domain was found." },
  { error: DomainNotVerifiedError, status: HttpStatus.CONFLICT, code: "domain-not-verified", detail: "The verification TXT record was not found yet. DNS changes can take a while to show." },
  { error: CourseNotForSaleError, status: HttpStatus.CONFLICT, code: "course-not-for-sale", detail: "This course or bundle has no price yet." },
  { error: AlreadyEnrolledError, status: HttpStatus.CONFLICT, code: "already-enrolled", detail: "You already have this course, or every course of this bundle." },
  { error: PaymentMethodUnavailableError, status: HttpStatus.BAD_REQUEST, code: "payment-method-unavailable", detail: "This payment method cannot take this payment." },
  { error: InvalidCouponError, status: HttpStatus.BAD_REQUEST, code: "invalid-coupon", detail: "This coupon cannot be used on this course." },
  { error: CouponCodeTakenError, status: HttpStatus.CONFLICT, code: "coupon-code-taken", detail: "The school already has a coupon with this code." },
  { error: CouponNotFoundError, status: HttpStatus.NOT_FOUND, code: "coupon-not-found", detail: "The coupon does not exist." },
  { error: BundleNotFoundError, status: HttpStatus.NOT_FOUND, code: "bundle-not-found", detail: "The bundle does not exist." },
  { error: UnknownBundleCourseError, status: HttpStatus.BAD_REQUEST, code: "unknown-bundle-course", detail: "A course in the bundle does not exist." },
  { error: OrderNotFoundError, status: HttpStatus.NOT_FOUND, code: "order-not-found", detail: "The order does not exist." },
  { error: LessonNotFoundError, status: HttpStatus.NOT_FOUND, code: "lesson-not-found", detail: "The lesson does not exist." },
  { error: LessonMediaMissingError, status: HttpStatus.NOT_FOUND, code: "lesson-media-missing", detail: "The lesson has no file yet." },
  { error: UnsupportedMediaError, status: HttpStatus.UNSUPPORTED_MEDIA_TYPE, code: "unsupported-media", detail: "This kind of file is not accepted here." },
  { error: MediaTooLargeError, status: HttpStatus.PAYLOAD_TOO_LARGE, code: "media-too-large", detail: "The file is too large." },
  { error: InvalidMediaKeyError, status: HttpStatus.BAD_REQUEST, code: "invalid-media-key", detail: "This file does not belong to the lesson." },
  { error: MediaNotUploadedError, status: HttpStatus.CONFLICT, code: "media-not-uploaded", detail: "The upload has not finished." },
  { error: CourseNotFoundError, status: HttpStatus.NOT_FOUND, code: "course-not-found", detail: "The course does not exist." },
  { error: QuizNotFoundError, status: HttpStatus.NOT_FOUND, code: "quiz-not-found", detail: "The lesson has no quiz." },
  { error: CommentNotFoundError, status: HttpStatus.NOT_FOUND, code: "comment-not-found", detail: "The comment does not exist." },
  { error: CertificateNotFoundError, status: HttpStatus.NOT_FOUND, code: "certificate-not-found", detail: "No certificate has this verification code." },
  { error: NotCommentAuthorError, status: HttpStatus.FORBIDDEN, code: "not-comment-author", detail: "Only its author can delete this comment." },
  { error: LessonLockedError, status: HttpStatus.FORBIDDEN, code: "lesson-locked", detail: "This lesson has not opened yet." },
  { error: NotEnrolledError, status: HttpStatus.FORBIDDEN, code: "not-enrolled", detail: "You are not enrolled in this course." },
  { error: InvalidUnsubscribeLinkError, status: HttpStatus.NOT_FOUND, code: "invalid-unsubscribe-link", detail: "This unsubscribe link is not valid." },
  { error: InvalidStatsRangeError, status: HttpStatus.BAD_REQUEST, code: "invalid-stats-range", detail: "Pick a range of up to a year that ends after it starts." },
  { error: ThrottlerException, status: HttpStatus.TOO_MANY_REQUESTS, code: "rate-limited", detail: "Too many attempts. Wait a few minutes, then try again." },
];

/**
 * Builds a problem whose type is only its HTTP status.
 *
 * @param status HTTP status.
 * @param detail Explanation, when there is a safe one.
 * @returns The problem.
 */
function statusProblem(status: number, detail?: string): Problem {
  return { type: "about:blank", title: STATUS_CODES[status] ?? "Error", status, ...(detail && { detail }) };
}

/**
 * Reads the caller-facing message of a Nest HTTP exception.
 *
 * @param exception The exception.
 * @returns Its message.
 */
function detailOf(exception: HttpException): string {
  const response = exception.getResponse();
  if (typeof response === "string") return response;
  const { message } = response as { message?: unknown };
  return typeof message === "string" ? message : exception.message;
}

/**
 * Maps anything a handler throws to the problem the caller sees. Unknown errors become a bare 500
 * so no internals (messages, stacks, SQL) leak.
 *
 * @param exception What was thrown.
 * @returns The problem, and whether the error was unexpected and must be logged.
 */
export function toProblem(exception: unknown): { problem: Problem; isUnexpected: boolean } {
  if (exception instanceof RequestValidationError) {
    const errors = exception.issues.map((issue) => ({ pointer: `#/${issue.path.join("/")}`, detail: issue.message }));
    return { problem: { ...statusProblem(HttpStatus.BAD_REQUEST, "The request has invalid fields."), errors }, isUnexpected: false };
  }
  const domain = DOMAIN_PROBLEMS.find(({ error }) => exception instanceof error);
  if (domain) {
    return { problem: { ...statusProblem(domain.status, domain.detail), type: PROBLEM_TYPE_PREFIX + domain.code }, isUnexpected: false };
  }
  if (exception instanceof HttpException) {
    const status = exception.getStatus();
    return { problem: statusProblem(status, detailOf(exception)), isUnexpected: status >= HttpStatus.INTERNAL_SERVER_ERROR };
  }
  return { problem: statusProblem(HttpStatus.INTERNAL_SERVER_ERROR), isUnexpected: true };
}
