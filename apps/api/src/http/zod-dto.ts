import type { z } from "zod";

/** A class Nest can use as a parameter type, carrying the zod schema the global pipe validates with. */
export interface ZodDto<Schema extends z.ZodType = z.ZodType> {
  new (): z.output<Schema>;
  /** Schema from `@reanit/core`; the single source of truth for the shape. */
  readonly schema: Schema;
}

/**
 * Turns a `@reanit/core` schema into a DTO class, so a handler's `@Body() body: SignUpBody`
 * is validated by the global `ZodValidationPipe` without duplicating the shape.
 *
 * @param schema The schema to validate with.
 * @returns A class to extend: `class SignUpBody extends createZodDto(signUpSchema) {}`.
 */
export function createZodDto<Schema extends z.ZodType>(schema: Schema): ZodDto<Schema> {
  /** Carries the schema; Nest passes the class as the parameter's metatype. */
  class Dto {
    static readonly schema = schema;
  }
  return Dto as unknown as ZodDto<Schema>;
}

/**
 * Tells whether a parameter type was made by `createZodDto`.
 *
 * @param metatype The parameter's type from Nest's metadata.
 * @returns True when it carries a schema.
 */
export function isZodDto(metatype: unknown): metatype is ZodDto {
  return typeof metatype === "function" && "schema" in metatype;
}
