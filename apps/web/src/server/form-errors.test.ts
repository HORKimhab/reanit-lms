import { describe, expect, it } from "vitest";
import { z } from "zod";

import { invalidFieldsOf } from "./form-errors";

const schema = z.object({ email: z.email(), password: z.string().min(8).regex(/\d/) });

describe("invalidFieldsOf", () => {
  it("lists each rejected field once, in issue order", () => {
    const result = schema.safeParse({ email: "nope", password: "short" });

    expect(invalidFieldsOf(result.error!)).toEqual(["email", "password"]); // the input above is invalid
  });

  it("lists only the fields that failed", () => {
    const result = schema.safeParse({ email: "dara@example.com", password: "" });

    expect(invalidFieldsOf(result.error!)).toEqual(["password"]); // the input above is invalid
  });
});
