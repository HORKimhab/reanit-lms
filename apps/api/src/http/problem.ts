import { STATUS_CODES } from "node:http";

import { HttpException, HttpStatus } from "@nestjs/common";
import { EmailTakenError, InvalidCredentialsError, InvalidMagicLinkError } from "@reanit/core/auth";
import { CourseNotFoundError } from "@reanit/core/catalog";
import { NotSchoolStaffError, SchoolNotFoundError, SubdomainTakenError } from "@reanit/core/schools";

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
  { error: SubdomainTakenError, status: HttpStatus.CONFLICT, code: "subdomain-taken", detail: "Another school already uses this subdomain." },
  { error: NotSchoolStaffError, status: HttpStatus.FORBIDDEN, code: "not-school-staff", detail: "You do not run a school." },
  { error: SchoolNotFoundError, status: HttpStatus.NOT_FOUND, code: "school-not-found", detail: "No school uses this subdomain." },
  { error: CourseNotFoundError, status: HttpStatus.NOT_FOUND, code: "course-not-found", detail: "The course does not exist." },
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
