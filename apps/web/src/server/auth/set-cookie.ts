/** A cookie as a `Set-Cookie` header describes it, in the shape `cookies().set` takes. */
export interface ParsedCookie {
  name: string;
  value: string;
  options: {
    path?: string;
    expires?: Date;
    maxAge?: number;
    httpOnly?: boolean;
    secure?: boolean;
    sameSite?: "lax" | "strict" | "none";
  };
}

const SAME_SITE_VALUES = new Set(["lax", "strict", "none"]);

/**
 * Parses one `Set-Cookie` header, so a cookie the API sets can be passed on to the browser.
 *
 * @param header The header value, e.g. `reanit_session=abc; Path=/; HttpOnly; SameSite=Lax`.
 * @returns The cookie, or null when the header has no `name=value` pair.
 */
export function parseSetCookie(header: string): ParsedCookie | null {
  const [pair = "", ...attributes] = header.split(";").map((part) => part.trim());
  const separator = pair.indexOf("=");
  if (separator <= 0) return null;
  const cookie: ParsedCookie = {
    name: pair.slice(0, separator),
    value: decodeURIComponent(pair.slice(separator + 1)),
    options: {},
  };
  for (const attribute of attributes) {
    const [key = "", value = ""] = attribute.split("=");
    const name = key.toLowerCase();
    if (name === "path") cookie.options.path = value;
    else if (name === "expires") cookie.options.expires = new Date(value);
    else if (name === "max-age") cookie.options.maxAge = Number(value);
    else if (name === "httponly") cookie.options.httpOnly = true;
    else if (name === "secure") cookie.options.secure = true;
    else if (name === "samesite" && SAME_SITE_VALUES.has(value.toLowerCase())) {
      cookie.options.sameSite = value.toLowerCase() as ParsedCookie["options"]["sameSite"];
    }
  }
  return cookie;
}
