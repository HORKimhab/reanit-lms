import { Injectable, type ArgumentMetadata, type PipeTransform } from "@nestjs/common";
import type { z } from "zod";

import { isZodDto } from "./zod-dto";

/** A request body, query or param that does not match its schema; answered with 400. */
export class RequestValidationError extends Error {
  override readonly name = "RequestValidationError";

  /**
   * Keeps the zod issues so the response can say which fields are wrong.
   *
   * @param issues What zod rejected.
   */
  constructor(readonly issues: z.core.$ZodIssue[]) {
    super("Request validation failed");
  }
}

/** Global pipe: parses every parameter typed with a `createZodDto` class and passes the rest through. */
@Injectable()
export class ZodValidationPipe implements PipeTransform {
  /**
   * Validates a parameter against its DTO's schema.
   *
   * @param value The raw parameter.
   * @param metadata Nest's description of the parameter.
   * @returns The parsed value (defaults applied, unknown keys stripped), or the value as is when it has no schema.
   * @throws {RequestValidationError} When the value does not match.
   */
  transform(value: unknown, metadata: ArgumentMetadata) {
    if (!isZodDto(metadata.metatype)) return value;
    const result = metadata.metatype.schema.safeParse(value);
    if (!result.success) throw new RequestValidationError(result.error.issues);
    return result.data;
  }
}
