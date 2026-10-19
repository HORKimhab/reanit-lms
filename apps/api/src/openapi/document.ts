import type { INestApplication } from "@nestjs/common";
import { DocumentBuilder, SwaggerModule, type OpenAPIObject } from "@nestjs/swagger";

/** Version of the HTTP contract; bump on a breaking change. */
const API_VERSION = "1";

/**
 * Builds the OpenAPI document from the app's controllers and their zod DTOs.
 *
 * @param app The app, created but not necessarily listening.
 * @returns The document.
 */
export function buildOpenApiDocument(app: INestApplication): OpenAPIObject {
  const config = new DocumentBuilder()
    .setTitle("Reanit API")
    .setDescription("REST API of Reanit LMS. Errors are RFC 9457 application/problem+json.")
    .setVersion(API_VERSION)
    .build();
  return SwaggerModule.createDocument(app, config);
}

/**
 * Serializes the document the way it is committed, so regenerating an unchanged API changes no bytes.
 *
 * @param document The document.
 * @returns Pretty-printed JSON ending in a newline.
 */
export function serializeOpenApiDocument(document: OpenAPIObject): string {
  return `${JSON.stringify(document, null, 2)}\n`;
}
