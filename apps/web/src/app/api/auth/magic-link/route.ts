import { InvalidMagicLinkError, safeRedirectPath } from "@reanit/core/auth";
import { redirect } from "next/navigation";
import type { NextRequest } from "next/server";

import { getAuthService } from "@/server/auth/service";
import { setSessionCookie } from "@/server/auth/session";

/** Login page (WEB-10) with the error it should show. */
const INVALID_LINK_PATH = "/login?error=invalid-link";

/**
 * Signs in from an emailed magic link, then goes to the link's `next` path.
 *
 * @param request Request carrying `token` and optional `next` in the query.
 * @returns Never; it always redirects.
 * @throws {Error} Next's redirect signal, or any unexpected failure.
 */
export async function GET(request: NextRequest): Promise<never> {
  const { searchParams } = request.nextUrl;
  const token = searchParams.get("token");
  if (!token) redirect(INVALID_LINK_PATH);
  try {
    await setSessionCookie(await getAuthService().verifyMagicLink(token));
  } catch (error) {
    if (error instanceof InvalidMagicLinkError) redirect(INVALID_LINK_PATH);
    throw error;
  }
  redirect(safeRedirectPath(searchParams.get("next")));
}
