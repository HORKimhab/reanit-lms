import { notFound } from "next/navigation";

/**
 * Catches paths no route matches, so they get the localized 404 instead of Next's default.
 *
 * @throws {Error} Next's not-found signal, always.
 */
export default function UnknownPath(): never {
  notFound();
}
