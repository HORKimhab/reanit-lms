import { z } from "zod";

/** A class Nest can use as a parameter type, carrying the zod schema the global pipe validates with. */
export interface ZodDto<Schema extends z.ZodType = z.ZodType> {
  new (): z.output<Schema>;
  /** Schema from `@reanit/core`; the single source of truth for the shape. */
  readonly schema: Schema;
}

/** The parts of a JSON Schema object that become documented properties. */
type ObjectJsonSchema = { properties?: Record<string, object>; required?: string[] };

/**
 * Describes a schema's top-level properties the way `@nestjs/swagger` reads a model, so the
 * OpenAPI spec shows the request shape the pipe enforces (nested objects and arrays included).
 *
 * @param schema An object schema.
 * @returns Swagger property options keyed by property name.
 */
function toSwaggerProperties(schema: z.ZodType): Record<string, object> {
  const json = z.toJSONSchema(schema, { target: "openapi-3.0", io: "input" }) as ObjectJsonSchema;
  return Object.fromEntries(
    Object.entries(json.properties ?? {}).map(([key, property]) => {
      const isRequired = json.required?.includes(key) ?? false;
      // Swagger takes a property without `type` (a union: oneOf/anyOf) for a circular class reference.
      const typed = "type" in property ? property : { type: "object", ...property };
      // An object property keeps its own `required` list; swagger reads `selfRequired` for the property itself.
      return [key, "required" in typed ? { ...typed, selfRequired: isRequired } : { ...typed, required: isRequired }];
    }),
  );
}

/**
 * Turns a `@reanit/core` schema into a DTO class, so a handler's `@Body() body: SignUpBody`
 * is validated by the global `ZodValidationPipe` and documented in the OpenAPI spec without
 * duplicating the shape.
 *
 * @param schema The object schema to validate with.
 * @returns A class to extend: `class SignUpBody extends createZodDto(signUpSchema) {}`.
 */
export function createZodDto<Schema extends z.ZodType>(schema: Schema): ZodDto<Schema> {
  /** Carries the schema; Nest passes the class as the parameter's metatype. */
  class Dto {
    static readonly schema = schema;

    /**
     * Hook `@nestjs/swagger` calls to read a model's properties.
     *
     * @returns The schema's properties.
     */
    static _OPENAPI_METADATA_FACTORY() {
      return toSwaggerProperties(schema);
    }
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
