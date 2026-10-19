import { BullModule } from "@nestjs/bullmq";
import { Module } from "@nestjs/common";
import type { EventHandlers } from "@reanit/core/events";
import { createOutboxStore, type DbClient } from "@reanit/db";
import { DB_CLIENT } from "@reanit/nest";

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

/** No event has background work yet; email (API-09) and certificates (WRK-03) register theirs here. */
const HANDLERS: EventHandlers = {};

/** The domain events pipeline: the outbox relay, the events queue with retries, and its dead-letter queue. */
@Module({
  imports: [BullModule.registerQueue({ name: EVENTS_QUEUE }, { name: EVENTS_DEAD_LETTER_QUEUE })],
  providers: [
    { provide: OUTBOX_STORE, inject: [DB_CLIENT], useFactory: provideOutboxStore },
    { provide: EVENT_HANDLERS, useValue: HANDLERS },
    { provide: EVENT_JOB_OPTIONS, useValue: DEFAULT_EVENT_JOB_OPTIONS },
    OutboxRelay,
    EventsProcessor,
  ],
})
export class EventsModule {}
