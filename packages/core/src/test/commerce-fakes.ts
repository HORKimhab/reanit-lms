// In-memory fakes of the commerce ports, for unit tests of checkout and confirmation.
import type {
  CommerceStore,
  Coupon,
  CouponInput,
  Currency,
  OrderSummary,
  PaymentCheck,
  PaymentConfirmationStore,
  PaymentGateway,
  PaymentMethod,
  PaymentRequest,
  Price,
  PriceInput,
  SellableCourse,
} from "../commerce";
import type { EmailLocale } from "../notifications";

/** A stored order with its buyer, coupon and gateway reference. */
type FakeOrder = OrderSummary & { userId: string; locale: EmailLocale; couponId: string | null };

/** In-memory `CommerceStore` for one school, whose rows tests can inspect. */
export class FakeCommerceStore implements CommerceStore {
  readonly courses = new Map<string, SellableCourse & { slug: string }>();
  readonly orders: FakeOrder[] = [];
  /** `userId:courseId` pairs. */
  readonly enrollments = new Set<string>();
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
   * Tells whether a user has a course.
   *
   * @param userId The user.
   * @param courseId The course.
   * @returns True when enrolled.
   */
  async isEnrolled(userId: string, courseId: string) {
    return this.enrollments.has(`${userId}:${courseId}`);
  }

  /**
   * Stores a pending order.
   *
   * @param order The order.
   * @param order.userId The buyer.
   * @param order.courseId The course.
   * @param order.price Its price.
   * @param order.amount What it charges.
   * @param order.couponId The coupon used, or null.
   * @param order.method The payment method.
   * @param order.locale The buyer's language.
   * @returns The order's id.
   */
  async createOrder({
    userId,
    courseId,
    price,
    amount,
    couponId,
    method,
    locale,
  }: {
    userId: string;
    courseId: string;
    price: Price;
    amount: number;
    couponId: string | null;
    method: PaymentMethod;
    locale: EmailLocale;
  }) {
    const id = `order-${this.orders.length + 1}`;
    this.orders.push({ id, userId, courseId, status: "pending", amount, currency: price.currency, method, locale, couponId, providerRef: null });
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
    if (!order) return null;
    const { userId: buyer, ...summary } = order;
    return buyer === userId ? { ...summary } : null;
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
    this.commerce.enrollments.add(`${order.userId}:${order.courseId}`);
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
