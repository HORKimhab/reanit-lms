import { describe, expect, it } from "vitest";

import { NotFoundError } from "@/test/navigation";

import UnknownPath from "./page";

describe("UnknownPath", () => {
  it("404s, so unknown paths get the localized not-found page", () => {
    expect(() => UnknownPath()).toThrow(NotFoundError);
  });
});
