import { StandaloneStatusPage } from "@/components/shells/standalone-status-page";

import "./globals.css";

/**
 * 404 for requests outside any locale (the proxy routes every page through one), in both languages.
 *
 * @returns The standalone not-found document.
 */
export default function RootNotFound() {
  return <StandaloneStatusPage kind="notFound" />;
}
