// In-memory fakes of the commerce ports, for unit tests of checkout and confirmation.
import type {
  Bundle,
  CommerceStore,
  Coupon,
  CouponInput,
  Currency,
  NewOrder,
  OrderDetail,
  OrderExpiryStore,
  OrderFilter,
  OrderHistoryStore,
  OrderLine,
  OrderSummary,
  PaymentCheck,
  PaymentConfirmationStore,
  PaymentGateway,
  PaymentMatch,
  PaymentMethod,
  PaymentRequest,
  PriceInput,
  RenewalSweepStore,
  RenewSubscription,
  SellableCourse,
  SubscriptionRecord,
  UpdateBundleInput,
} from "../commerce";
import type { EmailLocale } from "../notifications";

/** A stored order with its buyer, lines, bundle, coupon, subscription and references; `courseId` and `amount` sum up its lines. */
type FakeOrder = OrderSummary & {
  userId: string;
  locale: EmailLocale;
  couponId: string | null;
  bundleId: string | null;
  lines: OrderLine[];
  subscriptionId: string | null;
  /** The student's reference for an offline QR payment. */
  paymentReference: string | null;
  /** Set once refunded. */
  refund?: { at: Date; isRefundedByHand: boolean };
};

/** A stored subscription with its buyer. */
type FakeSubscription = SubscriptionRecord & { userId: string };

/** Order statuses a confirmation pays: not yet paid, expired or rejected, or waiting for staff. */
const CONFIRMABLE = new Set(["pending", "failed", "awaiting_confirmation"]);

/**
 * Shapes a stored order as the store returns it.
 *
 * @param order The stored order.
 * @returns Its summary.
 */
function summaryOf(order: FakeOrder): OrderSummary {
  const { id, status, courseId, amount, currency, method, providerRef } = order;
  return { id, status, courseId, amount, currency, method, providerRef };
}

/** In-memory `CommerceStore` for one school, whose rows tests can inspect. */
export class FakeCommerceStore implements CommerceStore {
  readonly courses = new Map<string, SellableCourse & { slug: string }>();
  readonly orders: FakeOrder[] = [];
  /** `userId:courseId` pairs, each with when access ends (null: for good). */
  readonly enrollments = new Map<string, Date | null>();
  readonly subscriptions: FakeSubscription[] = [];
  /** Whether the school uploaded its payment QR image. */
  hasQr = false;
  /** Bundles, newest first. */
  readonly bundles: Bundle[] = [];
  /** Coupons without their usage, newest first; `redemptions` is counted from paid orders. */
  readonly coupons: (CouponInput & { id: string })[] = [];

  /**
   * Adds how often a coupon was used: its paid orders.
   *
   * @param coupon A stored coupon.
   * @returns The coupon with its redemptions.
   */
  private withRedemptions(coupon: CouponInput & { id: string }): Coupon {
    return { ...coupon, redemptions: this.orders.filter((order) => order.couponId === coupon.id && order.status === "paid").length };
  }

  /**
   * Enrolls a user in a course.
   *
   * @param userId The user.
   * @param courseId The course.
   * @param accessUntil When access ends; null for good.
   */
  enroll(userId: string, courseId: string, accessUntil: Date | null = null) {
    this.enrollments.set(`${userId}:${courseId}`, accessUntil);
  }

  /**
   * Finds a course by slug.
   *
   * @param slug The course's slug.
   * @returns The course, or null.
   */
  async findCourse(slug: string) {
    return [...this.courses.values()].find((course) => course.slug === slug) ?? null;
  }

  /**
   * Reads a course's price.
   *
   * @param courseId The course.
   * @returns The price (null without one), or null for an unknown course.
   */
  async findCoursePrice(courseId: string) {
    const course = this.courses.get(courseId);
    return course ? { price: course.price } : null;
  }

  /**
   * Sets a course's price.
   *
   * @param courseId The course.
   * @param price The price.
   * @returns The new price, or null for an unknown course.
   */
  async setPrice(courseId: string, price: PriceInput) {
    const course = this.courses.get(courseId);
    if (!course) return null;
    course.price = { id: `price-${courseId}-${price.amount}`, ...price };
    return course.price;
  }

  /**
   * Lists the courses a user has among some.
   *
   * @param userId The user.
   * @param courseIds The courses to check.
   * @param at The moment access is checked at.
   * @returns The ones the user is enrolled in and whose access has not ended.
   */
  async enrolledCourseIds(userId: string, courseIds: string[], at: Date) {
    return courseIds.filter((courseId) => {
      const key = `${userId}:${courseId}`;
      const accessUntil = this.enrollments.get(key);
      return this.enrollments.has(key) && (accessUntil === null || accessUntil === undefined || accessUntil > at);
    });
  }

  /**
   * Lists which of some course ids the school has.
   *
   * @param courseIds The ids.
   * @returns The known ones.
   */
  async findCourseIds(courseIds: string[]) {
    return courseIds.filter((courseId) => this.courses.has(courseId));
  }

  /**
   * Stores a pending order.
   *
   * @param order The order.
   * @param order.userId The buyer.
   * @param order.price Its price.
   * @param order.lines Its courses and what each is charged.
   * @param order.bundleId The bundle bought, or null.
   * @param order.couponId The coupon used, or null.
   * @param order.method The payment method.
   * @param order.locale The buyer's language.
   * @param order.subscriptionId The subscription it pays a period of, or null.
   * @returns The order's id.
   */
  async createOrder({ userId, price, lines, bundleId, couponId, method, locale, subscriptionId }: NewOrder) {
    const id = `order-${this.orders.length + 1}`;
    const amount = lines.reduce((total, line) => total + line.amount, 0);
    this.orders.push({
      id,
      userId,
      courseId: lines[0]?.courseId ?? "",
      status: "pending",
      amount,
      currency: price.currency,
      method,
      locale,
      couponId,
      bundleId,
      lines,
      providerRef: null,
      subscriptionId,
      paymentReference: null,
    });
    return { id };
  }

  /**
   * Records the gateway's reference.
   *
   * @param orderId The order.
   * @param providerRef The reference.
   */
  async setProviderRef(orderId: string, providerRef: string) {
    const order = this.orders.find(({ id }) => id === orderId);
    if (order) order.providerRef = providerRef;
  }

  /**
   * Finds a buyer's order.
   *
   * @param orderId The order.
   * @param userId The buyer.
   * @returns The order, or null.
   */
  async findOrder(orderId: string, userId: string) {
    const order = this.orders.find((candidate) => candidate.id === orderId && candidate.userId === userId);
    return order ? summaryOf(order) : null;
  }

  /**
   * Marks a pending order, or one awaiting confirmation, failed.
   *
   * @param orderId The order.
   * @returns Whether it changed.
   */
  async failOrder(orderId: string) {
    const order = this.orders.find(({ id }) => id === orderId);
    if (order?.status !== "pending" && order?.status !== "awaiting_confirmation") return false;
    order.status = "failed";
    return true;
  }

  /**
   * Records a student's offline payment of their pending offline QR order.
   *
   * @param orderId The order.
   * @param userId The student.
   * @param reference Their transaction reference.
   * @returns False for any other order.
   */
  async submitOfflinePayment(orderId: string, userId: string, reference: string) {
    const order = this.orders.find((candidate) => candidate.id === orderId && candidate.userId === userId);
    if (order?.method !== "offline_qr" || order.status !== "pending") return false;
    Object.assign(order, { status: "awaiting_confirmation", paymentReference: reference });
    return true;
  }

  /**
   * Tells whether the school uploaded its payment QR.
   *
   * @returns `hasQr`.
   */
  async hasPaymentQr() {
    return this.hasQr;
  }

  /**
   * Starts a pending subscription to the course's or bundle's price with that id.
   *
   * @param subscription The buyer and price.
   * @param subscription.userId The buyer.
   * @param subscription.priceId The price.
   * @returns Its id.
   * @throws {Error} When no course or bundle has the price.
   */
  async createSubscription({ userId, priceId }: { userId: string; priceId: string }) {
    const course = [...this.courses.values()].find(({ price }) => price?.id === priceId);
    const bundle = this.bundles.find(({ price }) => price?.id === priceId);
    const product = course ? { title: course.title, price: course.price, courseIds: [course.id], bundleId: null } : bundle && { title: bundle.title, price: bundle.price, courseIds: bundle.courses.map(({ id }) => id), bundleId: bundle.id };
    if (!product?.price) throw new Error(`No course or bundle has price ${priceId}`);
    const id = `subscription-${this.subscriptions.length + 1}`;
    this.subscriptions.push({ id, userId, status: "pending", ...product, price: product.price, paidPeriods: 0, currentPeriodEnd: null });
    return { id };
  }

  /**
   * Finds a user's subscription.
   *
   * @param subscriptionId The subscription.
   * @param userId The user.
   * @returns The subscription, or null.
   */
  async findSubscription(subscriptionId: string, userId: string) {
    return this.subscriptions.find((candidate) => candidate.id === subscriptionId && candidate.userId === userId) ?? null;
  }

  /**
   * Lists a user's subscriptions that were ever paid, newest first.
   *
   * @param userId The user.
   * @returns The subscriptions.
   */
  async listSubscriptions(userId: string) {
    return this.subscriptions.filter((candidate) => candidate.userId === userId && candidate.status !== "pending").reverse();
  }

  /**
   * Finds any buyer's order.
   *
   * @param orderId The order.
   * @returns The order, or null.
   */
  async findSchoolOrder(orderId: string) {
    const order = this.orders.find(({ id }) => id === orderId);
    return order ? summaryOf(order) : null;
  }

  /**
   * Refunds a paid order and revokes its lines' enrollments.
   *
   * @param orderId The order.
   * @param refund When, and whether by hand.
   * @param refund.at When it was refunded.
   * @param refund.isRefundedByHand Whether staff paid the student back themselves.
   * @returns False when the order is not paid.
   */
  async refundOrder(orderId: string, refund: { at: Date; isRefundedByHand: boolean }) {
    const order = this.orders.find(({ id }) => id === orderId);
    if (order?.status !== "paid") return false;
    Object.assign(order, { status: "refunded", refund });
    for (const line of order.lines) this.enrollments.delete(`${order.userId}:${line.courseId}`);
    return true;
  }

  /**
   * Stores a coupon unless its code is taken.
   *
   * @param coupon The coupon.
   * @returns The coupon, or null when the code is taken.
   */
  async createCoupon(coupon: CouponInput) {
    if (this.coupons.some(({ code }) => code === coupon.code)) return null;
    const stored = { ...coupon, id: `coupon-${this.coupons.length + 1}` };
    this.coupons.unshift(stored);
    return this.withRedemptions(stored);
  }

  /**
   * Lists the coupons.
   *
   * @returns The coupons, newest first.
   */
  async listCoupons() {
    return this.coupons.map((coupon) => this.withRedemptions(coupon));
  }

  /**
   * Finds a coupon by code.
   *
   * @param code The code.
   * @returns The coupon, or null.
   */
  async findCoupon(code: string) {
    const coupon = this.coupons.find((candidate) => candidate.code === code);
    return coupon ? this.withRedemptions(coupon) : null;
  }

  /**
   * Deletes a coupon; orders keep their amount.
   *
   * @param couponId The coupon.
   * @returns False for an unknown coupon.
   */
  async deleteCoupon(couponId: string) {
    const index = this.coupons.findIndex(({ id }) => id === couponId);
    if (index < 0) return false;
    this.coupons.splice(index, 1);
    return true;
  }

  /**
   * Lists the bundles.
   *
   * @returns The bundles, newest first.
   */
  async listBundles() {
    return [...this.bundles];
  }

  /**
   * Finds a bundle by slug.
   *
   * @param slug The slug.
   * @returns The bundle, or null.
   */
  async findBundle(slug: string) {
    return this.bundles.find((bundle) => bundle.slug === slug) ?? null;
  }

  /**
   * Lists the bundles' slugs.
   *
   * @returns The slugs.
   */
  async listBundleSlugs() {
    return this.bundles.map((bundle) => bundle.slug);
  }

  /**
   * Stores a draft bundle of known courses.
   *
   * @param bundle The bundle.
   * @param bundle.title Its title.
   * @param bundle.slug Its slug.
   * @param bundle.courseIds Its courses, in order.
   * @returns The bundle.
   */
  async createBundle({ title, slug, courseIds }: { title: string; slug: string; courseIds: string[] }) {
    const bundle: Bundle = { id: `bundle-${this.bundles.length + 1}`, title, slug, description: null, status: "draft", courses: this.coursesOf(courseIds), price: null };
    this.bundles.unshift(bundle);
    return bundle;
  }

  /**
   * Changes a bundle.
   *
   * @param bundleId The bundle.
   * @param changes The fields to change.
   * @param changes.courseIds New courses, in order.
   * @returns The bundle, or null when unknown.
   */
  async updateBundle(bundleId: string, { courseIds, ...fields }: UpdateBundleInput) {
    const bundle = this.bundles.find(({ id }) => id === bundleId);
    if (!bundle) return null;
    Object.assign(bundle, fields, courseIds && { courses: this.coursesOf(courseIds) });
    return bundle;
  }

  /**
   * Sets a bundle's price.
   *
   * @param bundleId The bundle.
   * @param price The price.
   * @returns The new price, or null for an unknown bundle.
   */
  async setBundlePrice(bundleId: string, price: PriceInput) {
    const bundle = this.bundles.find(({ id }) => id === bundleId);
    if (!bundle) return null;
    bundle.price = { id: `price-${bundleId}-${price.amount}`, ...price };
    return bundle.price;
  }

  /**
   * Looks up courses by id, as a bundle lists them.
   *
   * @param courseIds The courses, in order.
   * @returns Their id, title and slug.
   */
  private coursesOf(courseIds: string[]) {
    return courseIds.flatMap((courseId) => {
      const course = this.courses.get(courseId);
      return course ? [{ id: course.id, title: course.title, slug: course.slug }] : [];
    });
  }
}

/** `PaymentConfirmationStore` over a `FakeCommerceStore`'s rows. */
export class FakeConfirmationStore implements PaymentConfirmationStore {
  /**
   * Wraps the store whose orders it confirms.
   *
   * @param commerce The fake commerce store.
   */
  constructor(private readonly commerce: FakeCommerceStore) {}

  /**
   * Marks the matching order paid and enrolls its buyer, once; a subscription's order moves its period
   * on with `renew`, and its enrollments last until the new access end.
   *
   * @param payment How to find the order.
   * @param at When it was confirmed.
   * @param renew Applies the paid period.
   * @returns The order and whether it was newly paid, or null.
   */
  async confirm(payment: PaymentMatch, at: Date, renew: RenewSubscription) {
    const order = this.commerce.orders.find((candidate) =>
      "offlineOrderId" in payment
        ? candidate.id === payment.offlineOrderId && candidate.method === "offline_qr"
        : candidate.method === payment.method && candidate.providerRef === payment.providerRef,
    );
    if (!order) return null;
    if (!CONFIRMABLE.has(order.status)) return { orderId: order.id, isNewlyPaid: false };
    order.status = "paid";
    const subscription = this.commerce.subscriptions.find(({ id }) => id === order.subscriptionId);
    let accessUntil: Date | null = null;
    if (subscription && subscription.price.billing.kind !== "one_time") {
      const change = renew({ billing: subscription.price.billing, paidPeriods: subscription.paidPeriods, currentPeriodEnd: subscription.currentPeriodEnd }, at);
      Object.assign(subscription, { status: change.status, paidPeriods: change.paidPeriods, currentPeriodEnd: change.currentPeriodEnd });
      accessUntil = change.accessUntil;
    }
    for (const line of order.lines) this.commerce.enroll(order.userId, line.courseId, accessUntil);
    return { orderId: order.id, isNewlyPaid: true };
  }
}

/** A gateway that takes the given currencies and redirects to a URL naming the order. */
export class FakeGateway implements PaymentGateway {
  readonly requests: PaymentRequest[] = [];

  /**
   * Configures the fake.
   *
   * @param method The method it stands for.
   * @param currencies The currencies it takes.
   */
  constructor(
    readonly method: PaymentGateway["method"],
    private readonly currencies: Currency[],
  ) {}

  /**
   * Tells whether it takes a currency.
   *
   * @param currency The currency.
   * @returns True when configured with it.
   */
  supports(currency: Currency) {
    return this.currencies.includes(currency);
  }

  /**
   * Records the request and redirects.
   *
   * @param request The payment request.
   * @returns A redirect naming the order.
   */
  async startPayment(request: PaymentRequest) {
    this.requests.push(request);
    return { kind: "redirect" as const, url: `https://pay.test/${request.orderId}`, providerRef: `ref-${request.orderId}` };
  }
}

/** A gateway that can also be asked about a payment, like PayWay and Bakong. */
export class AskableFakeGateway extends FakeGateway {
  /** What `checkPayment` answers. */
  checkResult: PaymentCheck = "pending";
  /** References it was asked about. */
  readonly checked: string[] = [];

  /**
   * Answers a status check with `checkResult`.
   *
   * @param providerRef The payment's reference.
   * @returns `checkResult`.
   */
  async checkPayment(providerRef: string) {
    this.checked.push(providerRef);
    return this.checkResult;
  }
}

/** A gateway that can also refund, like Stripe. */
export class RefundingFakeGateway extends FakeGateway {
  /** References it refunded. */
  readonly refunded: string[] = [];
  /** Set to make the next refund fail, as a gateway refusing it would. */
  failure: Error | null = null;

  /**
   * Records the refund, or fails with `failure`.
   *
   * @param providerRef The payment's reference.
   * @throws {Error} `failure`, when set.
   */
  async refund(providerRef: string) {
    if (this.failure) throw this.failure;
    this.refunded.push(providerRef);
  }
}

/** `OrderHistoryStore` that answers with `orders` and records the last filter and window it was asked for. */
export class FakeOrderHistoryStore implements OrderHistoryStore {
  orders: OrderDetail[] = [];
  total = 0;
  lastQuery: { filter: OrderFilter; window: { limit: number; offset: number } } | null = null;

  /**
   * Records the query and returns the programmed page.
   *
   * @param filter Which orders.
   * @param window The limit and offset.
   * @param window.limit Most orders returned.
   * @param window.offset Orders skipped.
   * @returns `orders` and `total`.
   */
  async listOrders(filter: OrderFilter, window: { limit: number; offset: number }) {
    this.lastQuery = { filter, window };
    return { orders: this.orders, total: this.total };
  }

  /**
   * Finds a programmed order.
   *
   * @param orderId The order.
   * @returns The order, or null.
   */
  async findOrder(orderId: string) {
    return this.orders.find(({ id }) => id === orderId) ?? null;
  }
}

/** `OrderExpiryStore` that records the cutoffs it was given and answers with `failed`. */
export class FakeOrderExpiryStore implements OrderExpiryStore {
  failed = 0;
  lastCutoffs: Record<PaymentMethod, Date> | null = null;

  /**
   * Records the cutoffs.
   *
   * @param placedBefore Each method's cutoff.
   * @returns `failed`.
   */
  async failPendingOrders(placedBefore: Record<PaymentMethod, Date>) {
    this.lastCutoffs = placedBefore;
    return this.failed;
  }
}

/** `RenewalSweepStore` that records the cutoffs it was given and answers with set counts. */
export class FakeRenewalSweepStore implements RenewalSweepStore {
  counts = { lapsed: 0, noticed: 0, reminded: 0 };
  /** Each call, in order, with its cutoff. */
  readonly calls: [string, Date][] = [];

  /**
   * Records a lapse cutoff.
   *
   * @param periodEndBefore The cutoff.
   * @returns `counts.lapsed`.
   */
  async lapseSubscriptions(periodEndBefore: Date) {
    this.calls.push(["lapse", periodEndBefore]);
    return this.counts.lapsed;
  }

  /**
   * Records a renewal notice cutoff.
   *
   * @param periodEndBefore The cutoff.
   * @returns `counts.noticed`.
   */
  async noticeRenewals(periodEndBefore: Date) {
    this.calls.push(["notice", periodEndBefore]);
    return this.counts.noticed;
  }

  /**
   * Records a last-day reminder cutoff.
   *
   * @param periodEndBefore The cutoff.
   * @returns `counts.reminded`.
   */
  async noticeLastGraceDays(periodEndBefore: Date) {
    this.calls.push(["lastDay", periodEndBefore]);
    return this.counts.reminded;
  }
}
