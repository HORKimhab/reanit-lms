import type { Mailer } from "../auth";
import { SUBSCRIPTION_GRACE_DAYS } from "../commerce";
import type { SubscriptionRenewalDue } from "../events";
import type { RenewalEmailComposer, RenewalNoticeStore } from "./ports";
import { schoolPageUrl } from "./rules";

const DAY_MS = 24 * 60 * 60 * 1000;

/** What `createRenewalEmails` needs. */
export interface RenewalEmailDependencies {
  /** Builds one school's renewal notice store; events name their school. */
  renewalsFor: (schoolId: string) => RenewalNoticeStore;
  mailer: Mailer;
  composer: RenewalEmailComposer;
  /** Public origin of the web app, for links. */
  appUrl: string;
}

/**
 * Builds the renewal emails: a link to pay the next period of a subscription or payment plan, sent
 * when the period is about to end and again on the grace period's last day, in the student's language.
 *
 * @param dependencies Renewal notice stores, mailer, composer and the web app's origin.
 * @param dependencies.renewalsFor Builds one school's renewal notice store.
 * @param dependencies.mailer Sends the emails.
 * @param dependencies.composer Writes them.
 * @param dependencies.appUrl Public origin of the web app.
 * @returns The renewal email operations.
 * @example
 * const renewals = createRenewalEmails({ renewalsFor, mailer, composer: renewalEmailComposer, appUrl: env.APP_URL });
 * await renewals.sendRenewalNotice(event);
 */
export function createRenewalEmails({ renewalsFor, mailer, composer, appUrl }: RenewalEmailDependencies) {
  return {
    /**
     * Emails the student a link to their purchases, where they pay the next period. Nothing is sent
     * when the email went stale meanwhile: the subscription was renewed, lapsed or is gone.
     *
     * @param event The `SubscriptionRenewalDue` event.
     * @param event.schoolId The school the subscription is in.
     * @param event.payload The subscription, the period end it is about, and whether it is the grace period's last day.
     */
    async sendRenewalNotice({ schoolId, payload }: SubscriptionRenewalDue): Promise<void> {
      const notice = await renewalsFor(schoolId).findRenewalNotice(payload.subscriptionId);
      if (notice?.status !== "active" || notice.currentPeriodEnd.toISOString() !== payload.periodEnd) return;
      const accessUntil = new Date(notice.currentPeriodEnd.getTime() + SUBSCRIPTION_GRACE_DAYS * DAY_MS);
      const payUrl = schoolPageUrl({ appUrl, locale: notice.locale, subdomain: notice.school.subdomain, path: "/purchases" });
      await mailer.send({ to: notice.student.email, ...(await composer.renewalDue({ notice, isLastDay: payload.isLastDay, accessUntil, payUrl })) });
    },
  };
}

/** The renewal email use cases. */
export type RenewalEmails = ReturnType<typeof createRenewalEmails>;
