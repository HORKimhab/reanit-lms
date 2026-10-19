import "reflect-metadata";

import { writeFile } from "node:fs/promises";

import { NestFactory } from "@nestjs/core";

import { AppModule } from "./app.module";
import { createAdapter } from "./context/request-id";
import { buildOpenApiDocument, serializeOpenApiDocument } from "./openapi/document";

/**
 * Writes the OpenAPI spec to the path given as the first argument. Preview mode reads the
 * controllers without creating providers, so no environment, database or Redis is needed.
 *
 * @throws {Error} When no output path is given.
 */
async function writeSpec() {
  const [outputPath] = process.argv.slice(2);
  if (!outputPath) throw new Error("Usage: node dist/openapi.js <output.json>");
  const app = await NestFactory.create(AppModule, createAdapter(), { preview: true, logger: false });
  await writeFile(outputPath, serializeOpenApiDocument(buildOpenApiDocument(app)));
  await app.close();
}

await writeSpec();
