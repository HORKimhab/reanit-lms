import { BullModule } from "@nestjs/bullmq";
import { Module } from "@nestjs/common";
import type { Mailer } from "@reanit/core/auth";
import type { EventHandlers } from "@reanit/core/events";
import { createCertificateIssuer } from "@reanit/core/learning";
import type { ObjectStorage } from "@reanit/core/media";
import { createPurchaseEmails } from "@reanit/core/notifications";
import { createCertificateStore, createOutboxStore, createReceiptStore, type DbClient } from "@reanit/db";
import { purchaseEmailComposer } from "@reanit/email";
import { DB_CLIENT, ENV, MAILER, OBJECT_STORAGE } from "@reanit/nest";

import { pdfCertificateRenderer } from "../certificates/pdf-renderer";
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
 * to each course; a completed course gets its certificate, with the PDF in object storage.
 *
 * @param db The shared database client; each event's data is read through its school's tenant client.
 * @param mailer Sends the emails.
 * @param storage Stores the certificate PDFs.
 * @param env Validated environment, for links to the web app.
 * @returns The handlers by event type.
 */
function provideEventHandlers(db: DbClient, mailer: Mailer, storage: ObjectStorage, env: WorkerEnv): EventHandlers {
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
  /**
   * Opens the certificates of the school an event belongs to.
   *
   * @param schoolId The event's school.
   * @returns Its certificate store on the tenant client.
   */
  function certificatesFor(schoolId: string) {
    return createCertificateStore(db, schoolId);
  }
  const certificates = createCertificateIssuer({ certificatesFor, renderer: pdfCertificateRenderer, storage, appUrl: env.APP_URL });
  return { OrderPaid: purchaseEmails.sendForOrder, CourseCompleted: certificates.issueForCompletion };
}

/** The domain events pipeline: the outbox relay, the events queue with retries, and its dead-letter queue. */
@Module({
  imports: [BullModule.registerQueue({ name: EVENTS_QUEUE }, { name: EVENTS_DEAD_LETTER_QUEUE })],
  providers: [
    { provide: OUTBOX_STORE, inject: [DB_CLIENT], useFactory: provideOutboxStore },
    { provide: EVENT_HANDLERS, inject: [DB_CLIENT, MAILER, OBJECT_STORAGE, ENV], useFactory: provideEventHandlers },
    { provide: EVENT_JOB_OPTIONS, useValue: DEFAULT_EVENT_JOB_OPTIONS },
    OutboxRelay,
    EventsProcessor,
  ],
})
export class EventsModule {}
