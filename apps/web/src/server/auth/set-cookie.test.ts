import { describe, expect, it } from "vitest";

import { parseSetCookie } from "./set-cookie";

describe("parseSetCookie", () => {
  it("reads the session cookie the API sets", () => {
    const header = "reanit_session=abc123; Path=/; Expires=Wed, 18 Nov 2026 00:00:00 GMT; HttpOnly; Secure; SameSite=Lax";

    expect(parseSetCookie(header)).toEqual({
      name: "reanit_session",
      value: "abc123",
      options: {
        path: "/",
        expires: new Date("2026-11-18T00:00:00Z"),
        httpOnly: true,
        secure: true,
        sameSite: "lax",
      },
    });
  });

  it("reads a cleared cookie with an empty value", () => {
    expect(parseSetCookie("reanit_session=; Max-Age=0; Path=/")).toEqual({
      name: "reanit_session",
      value: "",
      options: { maxAge: 0, path: "/" },
    });
  });

  it("decodes an encoded value", () => {
    expect(parseSetCookie("next=%2Fcourses")?.value).toBe("/courses");
  });

  it("ignores an unknown SameSite value", () => {
    expect(parseSetCookie("a=b; SameSite=Sometimes")?.options).toEqual({});
  });

  it.each(["", "novalue", "=abc"])("returns null for %j", (header) => {
    expect(parseSetCookie(header)).toBeNull();
  });
});
