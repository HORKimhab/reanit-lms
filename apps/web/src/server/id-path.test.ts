// @vitest-environment node
import { describe, expect, it } from "vitest";

import { NotFoundError } from "@/test/navigation";

import { idPath } from "./id-path";

describe("idPath", () => {
  it("passes a UUID on as the path's id", () => {
    expect(idPath("6f1c1f3e-1c5a-4a8e-9a39-2c1f1d9e0a50")).toEqual({ path: { id: "6f1c1f3e-1c5a-4a8e-9a39-2c1f1d9e0a50" } });
  });

  it.each([["not-a-uuid"], [null]])("404s on %j", (id) => {
    expect(() => idPath(id)).toThrow(NotFoundError);
  });
});
