import createMiddleware from "next-intl/middleware";

import { routing } from "./i18n/routing";

// Redirects and rewrites requests to the right locale.
export default createMiddleware(routing);

export const config = {
  // Skip API routes, Next internals and files with an extension.
  matcher: "/((?!api|_next|_vercel|.*\\..*).*)",
};
