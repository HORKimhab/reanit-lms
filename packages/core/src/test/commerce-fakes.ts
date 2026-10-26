// In-memory fakes of the commerce ports, for unit tests of checkout and confirmation.
import type {
  Bundle,
  CommerceStore,
  Coupon,
  CouponInput,
  Currency,
  OrderDetail,
  OrderFilter,
  OrderHistoryStore,
  OrderLine,
  OrderSummary,
  PaymentCheck,
  PaymentConfirmationStore,
  PaymentGateway,
  PaymentMethod,
  PaymentRequest,
  Price,
  PriceInput,
  SellableCourse,
  UpdateBundleInput,
} from "../commerce";
import type { EmailLocale } from "../notifications";

/** A stored order with its buyer, lines, bundle, coupon and gateway reference; `courseId` and `amount` sum up its lines. */
type FakeOrder = OrderSummary & {
  userId: string;
  locale: EmailLocale;
  couponId: string | null;
  bundleId: string | null;
  lines: OrderLine[];
  /** Set once refunded. */
  refund?: { at: Date; isRefundedByHand: boolean };
};

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
  /** `userId:courseId` pairs. */
  readonly enrollments = new Set<string>();
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
   * Finds a course by slug.
   *
   * @param slug The course's slug.
   * @returns The course, or null.
   */
  async findCourse(slug: string) {
    return [...this.courses.values()].find((course) => course.slug === slug) ?? null;
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
   * @returns The ones the user is enrolled in.
   */
  async enrolledCourseIds(userId: string, courseIds: string[]) {
    return courseIds.filter((courseId) => this.enrollments.has(`${userId}:${courseId}`));
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
   * @returns The order's id.
   */
  async createOrder({
    userId,
    price,
    lines,
    bundleId,
    couponId,
    method,
    locale,
  }: {
    userId: string;
    price: Price;
    lines: OrderLine[];
    bundleId: string | null;
    couponId: string | null;
    method: PaymentMethod;
    locale: EmailLocale;
  }) {
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
   * Marks the matching order paid and enrolls its buyer, once.
   *
   * @param method The gateway.
   * @param providerRef The gateway's reference.
   * @returns The order and whether it was newly paid, or null.
   */
  async confirm(method: PaymentMethod, providerRef: string) {
    const order = this.commerce.orders.find((candidate) => candidate.method === method && candidate.providerRef === providerRef);
    if (!order) return null;
    const isNewlyPaid = order.status === "pending";
    order.status = "paid";
    for (const line of order.lines) this.commerce.enrollments.add(`${order.userId}:${line.courseId}`);
    return { orderId: order.id, isNewlyPaid };
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
    readonly method: PaymentMethod,
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
