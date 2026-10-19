import { BullModule } from "@nestjs/bullmq";
import { Module } from "@nestjs/common";
import type { Mailer } from "@reanit/core/auth";
import type { EventHandlers } from "@reanit/core/events";
import { createPurchaseEmails } from "@reanit/core/notifications";
import { createOutboxStore, createReceiptStore, type DbClient } from "@reanit/db";
import { purchaseEmailComposer } from "@reanit/email";
import { DB_CLIENT, ENV, MAILER } from "@reanit/nest";

import type { WorkerEnv } from "../worker.module";
import { EventsProcessor } from "./events.processor";
import { DEFAULT_EVENT_JOB_OPTIONS, EVENT_HANDLERS, EVENT_JOB_OPTIONS, EVENTS_DEAD_LETTER_QUEUE, EVENTS_QUEUE, OUTBOX_STORE } from "./events.tokens";
import { OutboxRelay } from "./outbox-relay";

/**
 * Reads every school's outbox through the unscoped client: the relay is the one cross-tenant reader.
 *
 * @param db The shared database client.
 * @returns The outbox's relay side.
 */
function provideOutboxStore(db: DbClient) {
  return createOutboxStore(db);
}

/**
 * Wires each event type's background work: a paid order emails its buyer a receipt and a welcome
 * to each course. Certificates (WRK-03) register here too.
 *
 * @param db The shared database client; receipts are read through each event's school's tenant client.
 * @param mailer Sends the emails.
 * @param env Validated environment, for links to the web app.
 * @returns The handlers by event type.
 */
function provideEventHandlers(db: DbClient, mailer: Mailer, env: WorkerEnv): EventHandlers {
  /**
   * Opens the receipts of the school an event belongs to.
   *
   * @param schoolId The event's school.
   * @returns Its receipt store on the tenant client.
   */
  function receiptsFor(schoolId: string) {
    return createReceiptStore(db, schoolId);
  }
  const purchaseEmails = createPurchaseEmails({
    receiptsFor,
    mailer,
    composer: purchaseEmailComposer,
    appUrl: env.APP_URL,
  });
  return { OrderPaid: purchaseEmails.sendForOrder };
}

/** The domain events pipeline: the outbox relay, the events queue with retries, and its dead-letter queue. */
@Module({
  imports: [BullModule.registerQueue({ name: EVENTS_QUEUE }, { name: EVENTS_DEAD_LETTER_QUEUE })],
  providers: [
    { provide: OUTBOX_STORE, inject: [DB_CLIENT], useFactory: provideOutboxStore },
    { provide: EVENT_HANDLERS, inject: [DB_CLIENT, MAILER, ENV], useFactory: provideEventHandlers },
    { provide: EVENT_JOB_OPTIONS, useValue: DEFAULT_EVENT_JOB_OPTIONS },
    OutboxRelay,
    EventsProcessor,
  ],
})
export class EventsModule {}
