// Opens schools for integration tests, through the real school store.
import type { DbClient } from "../client";
import { createSchoolStore } from "../school-store";

/**
 * Creates an owner and a school they own.
 *
 * @param db Unscoped client on the test database.
 * @param subdomain Unique subdomain, also used for the owner's email.
 * @returns The school's id.
 */
export async function openTestSchool(db: DbClient, subdomain: string): Promise<string> {
  const owner = await db.user.create({ data: { email: `${subdomain}@example.com` } });
  return (await createSchoolStore(db).createSchoolWithOwner({ name: subdomain, subdomain, ownerId: owner.id })).id;
}
