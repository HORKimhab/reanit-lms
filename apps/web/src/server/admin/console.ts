import type { DuePayout } from "@reanit/core/commerce";
import { platformSchoolsQuerySchema, type PlatformSchoolPage, type PlatformSchoolsQuery, type SubmittedPlanPayment } from "@reanit/core/schools";
import { notFound, redirect } from "next/navigation";

import { getApi, unexpectedResponse } from "../api";
import { loginPath } from "../auth/session";

/** The admin console's pages; signed-out visitors log in and come back to the first. */
export const ADMIN_PATHS = { schools: "/admin/schools", planPayments: "/admin/plan-payments", payouts: "/admin/payouts" } as const;

/** The first page of every school, for a schools URL whose query makes no sense. */
const FIRST_PAGE: PlatformSchoolsQuery = { page: 1 };

/**
 * Turns an API answer to a platform admin route into the page's next step: signed-out visitors log in,
 * and anyone who is not a platform admin sees a 404, so the console's address gives nothing away.
 *
 * @param response The API's response to an admin route.
 * @throws {Error} Next's redirect or not-found signal, or an unexpected-response error.
 */
export function checkAdminResponse(response: Response) {
  if (response.ok) return;
  if (response.status === 401) redirect(loginPath(ADMIN_PATHS.schools));
  if (response.status === 403 || response.status === 404) notFound();
  throw unexpectedResponse(response);
}

/**
 * Reads the schools list's search and page from its URL query.
 *
 * @param query The page's search params.
 * @returns The parsed search, or the first page of every school when the query is malformed.
 */
export function schoolsQueryFrom(query: Record<string, string | string[] | undefined>): PlatformSchoolsQuery {
  const parsed = platformSchoolsQuerySchema.safeParse(query);
  return parsed.success ? parsed.data : FIRST_PAGE;
}

/**
 * Loads one page of the platform's schools.
 *
 * @param query The search and page.
 * @param query.q Text to find in a school's name, subdomain or owner's email.
 * @param query.page 1-based page.
 * @returns The page's schools, newest first, with dates as dates, and how many match.
 * @throws {Error} Next's redirect or not-found signal, or an unexpected-response error.
 */
export async function getPlatformSchools({ q, page }: PlatformSchoolsQuery): Promise<PlatformSchoolPage> {
  const { data, response } = await (await getApi()).GET("/admin/schools", { params: { query: { ...(q && { q }), page } } });
  checkAdminResponse(response);
  // checkAdminResponse returned, so the API answered 2xx with the page.
  const result = data!;
  return {
    ...result,
    schools: result.schools.map(({ createdAt, paidUntil, suspension, ...school }) => ({
      ...school,
      createdAt: new Date(createdAt),
      paidUntil: paidUntil ? new Date(paidUntil) : null,
      suspension: suspension && { ...suspension, at: new Date(suspension.at) },
    })),
  };
}

/**
 * Loads the payments to the platform's QR whose creators say they paid.
 *
 * @returns The payments, oldest first, with dates as dates.
 * @throws {Error} Next's redirect or not-found signal, or an unexpected-response error.
 */
export async function getSubmittedPlanPayments(): Promise<SubmittedPlanPayment[]> {
  const { data, response } = await (await getApi()).GET("/admin/plan-payments");
  checkAdminResponse(response);
  // checkAdminResponse returned, so the API answered 2xx with the payments.
  return data!.payments.map((payment) => ({ ...payment, submittedAt: new Date(payment.submittedAt) }));
}

/**
 * Loads the payouts due: each school's available balance that reaches the minimum.
 *
 * @returns The payouts due, with where to send each.
 * @throws {Error} Next's redirect or not-found signal, or an unexpected-response error.
 */
export async function getDuePayouts(): Promise<DuePayout[]> {
  const { data, response } = await (await getApi()).GET("/admin/payouts/due");
  checkAdminResponse(response);
  // checkAdminResponse returned, so the API answered 2xx with the payouts.
  return data!.payouts;
}
