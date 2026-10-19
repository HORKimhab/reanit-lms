// In-memory fakes of the commerce ports, for unit tests of checkout and confirmation.
import type {
  CommerceStore,
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

/** A stored order with its buyer and gateway reference. */
type FakeOrder = OrderSummary & { userId: string; locale: EmailLocale };

/** In-memory `CommerceStore` for one school, whose rows tests can inspect. */
export class FakeCommerceStore implements CommerceStore {
  readonly courses = new Map<string, SellableCourse & { slug: string }>();
  readonly orders: FakeOrder[] = [];
  /** `userId:courseId` pairs. */
  readonly enrollments = new Set<string>();

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
   * @param order.method The payment method.
   * @param order.locale The buyer's language.
   * @returns The order's id.
   */
  async createOrder({ userId, courseId, price, method, locale }: { userId: string; courseId: string; price: Price; method: PaymentMethod; locale: EmailLocale }) {
    const id = `order-${this.orders.length + 1}`;
    this.orders.push({ id, userId, courseId, status: "pending", amount: price.amount, currency: price.currency, method, locale, providerRef: null });
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
