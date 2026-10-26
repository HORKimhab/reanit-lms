// Fakes of the notifications ports, for unit tests of the purchase emails, staff emails and email settings.
import { DEFAULT_NOTIFICATION_PREFERENCES } from "../notifications";
import type { MembershipRole } from "../schools";
import type {
  CommentNotice,
  CompletionNotice,
  ComposedEmail,
  NotificationKind,
  NotificationPreferences,
  NotificationPreferenceStore,
  OrderReceipt,
  PurchaseEmailComposer,
  ReceiptStore,
  StaffEmailBase,
  StaffEmailComposer,
  StaffNoticeStore,
  StaffRecipient,
} from "../notifications";

/** A paid order of two USD courses, in Khmer, for tests of the emails it sends. */
export const TEST_RECEIPT: OrderReceipt = {
  orderId: "order-1",
  locale: "km",
  paidAt: new Date("2026-10-19T08:00:00Z"),
  buyer: { email: "sokha@example.com", name: "Sokha" },
  school: { name: "Angkor Academy", subdomain: "angkor" },
  items: [
    { title: "Brand", slug: "brand", amount: 4900, currency: "USD" },
    { title: "Social", slug: "social", amount: 2500, currency: "USD" },
  ],
  total: { amount: 7400, currency: "USD" },
};

/** In-memory `ReceiptStore` for one school. */
export class FakeReceiptStore implements ReceiptStore {
  readonly receipts = new Map<string, OrderReceipt>();

  /**
   * Finds a stored receipt.
   *
   * @param orderId The order.
   * @returns The receipt, or null.
   */
  async findReceipt(orderId: string) {
    return this.receipts.get(orderId) ?? null;
  }
}

/** Composer whose emails name what they were written from, so tests can check what was sent. */
export class FakeComposer implements PurchaseEmailComposer {
  /**
   * Writes a receipt naming the order, its language and the link.
   *
   * @param email The receipt and the My courses link.
   * @param email.receipt The receipt.
   * @param email.myCoursesUrl The link.
   * @returns The email.
   */
  async purchaseReceipt({ receipt, myCoursesUrl }: { receipt: OrderReceipt; myCoursesUrl: string }): Promise<ComposedEmail> {
    return { subject: `Receipt ${receipt.orderId} (${receipt.locale})`, text: myCoursesUrl };
  }

  /**
   * Writes a welcome naming the course, its language and the link.
   *
   * @param email The course and the link.
   * @param email.locale The language.
   * @param email.courseTitle The course.
   * @param email.courseUrl The link.
   * @returns The email.
   */
  async courseWelcome({ locale, courseTitle, courseUrl }: { locale: string; courseTitle: string; courseUrl: string }): Promise<ComposedEmail> {
    return { subject: `Welcome to ${courseTitle} (${locale})`, text: courseUrl };
  }
}

/** A staff member as `FakeStaffNoticeStore` keeps them. */
type FakeStaffMember = StaffRecipient & { role: MembershipRole; turnedOff: NotificationKind[] };

/** In-memory `StaffNoticeStore` for one school: its staff, comments and completions. */
export class FakeStaffNoticeStore implements StaffNoticeStore {
  readonly staff: FakeStaffMember[] = [];
  readonly comments = new Map<string, CommentNotice>();
  readonly completions = new Map<string, CompletionNotice>();

  /**
   * Lists staff with one of the roles who have not turned the kind off.
   *
   * @param kind The kind of email.
   * @param roles The roles it goes to.
   * @returns The recipients.
   */
  async findRecipients(kind: NotificationKind, roles: readonly MembershipRole[]) {
    return this.staff
      .filter((member) => roles.includes(member.role) && !member.turnedOff.includes(kind))
      .map(({ role: _role, turnedOff: _turnedOff, ...recipient }) => recipient);
  }

  /**
   * Finds a stored comment.
   *
   * @param commentId The comment.
   * @returns The comment, or null.
   */
  async findComment(commentId: string) {
    return this.comments.get(commentId) ?? null;
  }

  /**
   * Finds a stored completion.
   *
   * @param enrollmentId The enrollment.
   * @returns The completion, or null.
   */
  async findCompletion(enrollmentId: string) {
    return this.completions.get(enrollmentId) ?? null;
  }
}

/**
 * Summarizes the parts every staff email shares, so tests can check them in the text.
 *
 * @param base The shared parts.
 * @param base.locale The reader's language.
 * @param base.schoolName The school.
 * @param base.unsubscribeUrl The unsubscribe link.
 * @param base.preferencesUrl The settings link.
 * @returns One line naming them.
 */
function describeBase({ locale, schoolName, unsubscribeUrl, preferencesUrl }: StaffEmailBase) {
  return `${locale} | ${schoolName} | ${unsubscribeUrl} | ${preferencesUrl}`;
}

/** Composer whose staff emails name what they were written from. */
export class FakeStaffComposer implements StaffEmailComposer {
  /**
   * Writes a sale email naming the buyer, courses, total and link.
   *
   * @param email What the email says.
   * @returns The email.
   */
  async newSale(email: Parameters<StaffEmailComposer["newSale"]>[0]): Promise<ComposedEmail> {
    const { buyer, courseTitles, total, salesUrl } = email;
    return { subject: `Sale to ${buyer.email}: ${courseTitles.join(", ")} for ${total.amount} ${total.currency}`, text: `${salesUrl} | ${describeBase(email)}` };
  }

  /**
   * Writes a comment email naming the author, lesson and link.
   *
   * @param email What the email says.
   * @returns The email.
   */
  async newComment(email: Parameters<StaffEmailComposer["newComment"]>[0]): Promise<ComposedEmail> {
    return { subject: `Comment by ${email.authorName} on ${email.lessonTitle} (${email.courseTitle}): ${email.body}`, text: `${email.inboxUrl} | ${describeBase(email)}` };
  }

  /**
   * Writes a completion email naming the student, course and link.
   *
   * @param email What the email says.
   * @returns The email.
   */
  async courseCompleted(email: Parameters<StaffEmailComposer["courseCompleted"]>[0]): Promise<ComposedEmail> {
    return { subject: `${email.studentEmail} completed ${email.courseTitle}`, text: `${email.studentsUrl} | ${describeBase(email)}` };
  }
}

/** In-memory `NotificationPreferenceStore`: settings by school and user, and unsubscribe tokens. */
export class FakePreferenceStore implements NotificationPreferenceStore {
  /** Settings by `<schoolId>/<userId>`. */
  readonly preferences = new Map<string, NotificationPreferences>();
  /** The school and user each token belongs to, and the school's name. */
  readonly tokens = new Map<string, { schoolId: string; userId: string; schoolName: string }>();

  /**
   * Finds saved settings.
   *
   * @param schoolId The school.
   * @param userId The staff member.
   * @returns The settings, or null.
   */
  async findPreferences(schoolId: string, userId: string) {
    return this.preferences.get(`${schoolId}/${userId}`) ?? null;
  }

  /**
   * Saves settings.
   *
   * @param schoolId The school.
   * @param userId The staff member.
   * @param preferences The settings.
   * @returns The settings.
   */
  async savePreferences(schoolId: string, userId: string, preferences: NotificationPreferences) {
    this.preferences.set(`${schoolId}/${userId}`, preferences);
    return preferences;
  }

  /**
   * Turns a kind off for the token's staff member.
   *
   * @param token The token.
   * @param kind The kind of email.
   * @returns The school's name, or null for an unknown token.
   */
  async unsubscribe(token: string, kind: NotificationKind) {
    const owner = this.tokens.get(token);
    if (!owner) return null;
    const key = `${owner.schoolId}/${owner.userId}`;
    const current = this.preferences.get(key) ?? DEFAULT_NOTIFICATION_PREFERENCES;
    this.preferences.set(key, { ...current, [kind]: false });
    return { schoolName: owner.schoolName };
  }
}
