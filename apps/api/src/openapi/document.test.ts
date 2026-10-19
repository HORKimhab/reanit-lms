import { readFile } from "node:fs/promises";

import { Body, Controller, Get, Post, Query } from "@nestjs/common";
import type { NestFastifyApplication } from "@nestjs/platform-fastify";
import { signUpSchema } from "@reanit/core/auth";
import { outlineSchema } from "@reanit/core/catalog";
import { afterEach, describe, expect, it } from "vitest";
import { z } from "zod";

import { createZodDto } from "../http/zod-dto";
import { createTestApp } from "../test/app";
import { buildOpenApiDocument, serializeOpenApiDocument } from "./document";

/** The spec `packages/api-client` generates its types from; `pnpm openapi` rewrites it. */
const COMMITTED_SPEC = new URL("../../../../packages/api-client/openapi.json", import.meta.url);

/** Sign-up body from the core schema. */
class SignUpBody extends createZodDto(signUpSchema) {}

/** Course outline body, with nested arrays. */
class OutlineBody extends createZodDto(outlineSchema) {}

/** Paging query. */
class PageQuery extends createZodDto(z.object({ page: z.coerce.number().int().min(1).default(1), search: z.string().optional() })) {}

/** Routes typed with zod DTOs, to check what the spec says about them. */
@Controller("docs-probe")
class DocsProbeController {
  /**
   * Accepts a sign-up body.
   *
   * @param body The body.
   * @returns The body.
   */
  @Post("sign-up")
  signUp(@Body() body: SignUpBody) {
    return body;
  }

  /**
   * Accepts an outline body.
   *
   * @param body The body.
   * @returns The body.
   */
  @Post("outline")
  outline(@Body() body: OutlineBody) {
    return body;
  }

  /**
   * Accepts a paging query.
   *
   * @param query The query.
   * @returns The query.
   */
  @Get("page")
  page(@Query() query: PageQuery) {
    return query;
  }
}

let app: NestFastifyApplication | undefined;

afterEach(async () => {
  await app?.close();
  app = undefined;
});

/**
 * Builds the spec of the app with the probe routes mounted.
 *
 * @returns The document.
 */
async function probeDocument() {
  app = await createTestApp(undefined, { controllers: [DocsProbeController] });
  return buildOpenApiDocument(app);
}

describe("buildOpenApiDocument", () => {
  it("documents a zod body with its fields, limits and required list", async () => {
    const document = await probeDocument();

    expect(document.paths["/docs-probe/sign-up"]?.post?.requestBody).toMatchObject({
      content: { "application/json": { schema: { $ref: "#/components/schemas/SignUpBody" } } },
    });
    expect(document.components?.schemas?.SignUpBody).toMatchObject({
      type: "object",
      properties: { name: { type: "string", minLength: 1 }, email: { type: "string" }, password: { type: "string", minLength: 8 } },
      required: ["name", "email", "password"],
    });
  });

  it("documents nested arrays of objects", async () => {
    const document = await probeDocument();

    expect(document.components?.schemas?.OutlineBody).toMatchObject({
      properties: {
        sections: {
          type: "array",
          items: { properties: { lessons: { type: "array", items: { properties: { type: { enum: ["video", "text", "pdf"] } } } } } },
        },
      },
    });
  });

  it("documents a zod query as optional parameters with their defaults", async () => {
    const document = await probeDocument();

    expect(document.paths["/docs-probe/page"]?.get?.parameters).toEqual([
      expect.objectContaining({ name: "page", in: "query", required: false, schema: expect.objectContaining({ type: "integer", default: 1 }) }),
      expect.objectContaining({ name: "search", in: "query", required: false }),
    ]);
  });
});

describe("committed spec", () => {
  it("matches the app, so the typed client is current (run `pnpm openapi` after changing routes)", async () => {
    app = await createTestApp();

    const generated = serializeOpenApiDocument(buildOpenApiDocument(app));

    expect(await readFile(COMMITTED_SPEC, "utf8")).toBe(generated);
  });
});
