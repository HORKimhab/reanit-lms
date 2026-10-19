import { describe, expect, it } from "vitest";

import { schoolSubdomainFromHost, toSchoolPath } from "./host";

describe("schoolSubdomainFromHost", () => {
  it.each([
    ["angkor.reanit.com", "reanit.com", "angkor"],
    ["Angkor.Reanit.com", "reanit.com", "angkor"],
    ["angkor.localhost:3000", "localhost:3000", "angkor"],
  ])("reads the school from %s", (host, root, subdomain) => {
    expect(schoolSubdomainFromHost(host, root)).toBe(subdomain);
  });

  it.each([
    ["reanit.com", "the root domain"],
    ["angkor.other.com", "another domain"],
    ["evilreanit.com", "a look-alike domain"],
    ["a.b.reanit.com", "a nested subdomain"],
    ["www.reanit.com", "a reserved subdomain"],
    ["localhost:4000", "another port"],
  ])("returns null for %s (%s)", (host) => {
    expect(schoolSubdomainFromHost(host, "reanit.com")).toBeNull();
  });

  it("returns null without a host", () => {
    expect(schoolSubdomainFromHost(null, "reanit.com")).toBeNull();
  });
});

describe("toSchoolPath", () => {
  it.each([
    ["/en", "/en/s/angkor"],
    ["/en/", "/en/s/angkor"],
    ["/km/courses/intro", "/km/s/angkor/courses/intro"],
    ["/en/s/angkor/my-courses", "/en/s/angkor/my-courses"],
    ["/en/s/angkor", "/en/s/angkor"],
    ["/en/s/bayon/courses", "/en/s/angkor/s/bayon/courses"],
    ["/en/s/angkorian", "/en/s/angkor/s/angkorian"],
  ])("maps %s to %s", (pathname, schoolPath) => {
    expect(toSchoolPath(pathname, "angkor")).toBe(schoolPath);
  });

  it.each(["/en/login", "/km/signup", "/en/login/extra"])("leaves the platform page %s alone", (pathname) => {
    expect(toSchoolPath(pathname, "angkor")).toBeNull();
  });
});
