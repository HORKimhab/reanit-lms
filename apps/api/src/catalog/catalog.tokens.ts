import type { CatalogService } from "@reanit/core/catalog";

/** Injection token for `CatalogForSchool`. */
export const CATALOG_FOR_SCHOOL = Symbol("CATALOG_FOR_SCHOOL");

/** Builds one school's catalog service on the tenant client, so every query is limited to that school. */
export type CatalogForSchool = (schoolId: string) => CatalogService;
