import { Module } from "@nestjs/common";
import { createNotificationPreferences } from "@reanit/core/notifications";
import { createNotificationPreferenceStore, type DbClient } from "@reanit/db";
import { DB_CLIENT } from "@reanit/nest";

import { SchoolsModule } from "../schools/schools.module";
import { NotificationsController } from "./notifications.controller";
import { NOTIFICATION_PREFERENCES } from "./notifications.tokens";

/**
 * Wires staff email settings to Postgres.
 *
 * @param db The shared database client.
 * @returns The email settings service.
 */
function provideNotificationPreferences(db: DbClient) {
  return createNotificationPreferences(createNotificationPreferenceStore(db));
}

/** Staff email settings and unsubscribe links; the emails themselves are sent by the worker. */
@Module({
  imports: [SchoolsModule],
  controllers: [NotificationsController],
  providers: [{ provide: NOTIFICATION_PREFERENCES, inject: [DB_CLIENT], useFactory: provideNotificationPreferences }],
})
export class NotificationsModule {}
