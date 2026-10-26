import type { Clock } from "../auth";
import { CourseNotFoundError } from "../catalog";
import { uniqueSlug } from "../shared/slug";
import { splitAcrossCourses } from "./bundles";
import { applyCoupon } from "./coupons";
import {
  AlreadyEnrolledError,
  BundleNotFoundError,
  CouponCodeTakenError,
  CouponNotFoundError,
  CourseNotForSaleError,
  InvalidCouponError,
  OrderNotFoundError,
  OrderNotRefundableError,
  PaymentMethodUnavailableError,
  RefundByHandRequiredError,
  UnknownBundleCourseError,
  UnknownPaymentError,
} from "./errors";
import type {
  Bundle,
  Coupon,
  CommerceStore,
  Discount,
  OrderSummary,
  PaymentConfirmationStore,
  PaymentGateway,
  PaymentStart,
  Price,
} from "./ports";
import type {
  BundleCheckoutInput,
  CheckoutInput,
  CouponInput,
  CreateBundleInput,
  OfferQuery,
  PaymentMethod,
  PriceInput,
  RefundInput,
  UpdateBundleInput,
} from "./rules";

/** Slug for a bundle title with no Latin letters or digits. */
const FALLBACK_BUNDLE_SLUG = "bundle";

/** Who is paying. */
type Buyer = { userId: string; email: string };

/** Where the gateway sends the student back, given the new order's id. */
type ReturnUrls = (orderId: string) => { successUrl: string; cancelUrl: string };

/** How a course or bundle can be bought. */
type Offer = { price: Price | null; methods: PaymentMethod[]; discount: Discount | null };

/** What an order sells: one course, or a bundle's courses at the bundle's price. */
type Product = { title: string; price: Price; courseIds: string[]; bundleId: string | null };

/** What `createCommerceService` needs. */
export interface CommerceDependencies {
  /** The school's prices and orders. */
  store: CommerceStore;
  /** Every configured gateway; which ones a course offers depends on its currency. */
  gateways: readonly PaymentGateway[];
  /** Enrolls when a gateway that can be asked reports a pending order paid. */
  confirmation: PaymentConfirmation;
  /** The current time, for coupon expiry. */
  clock: Clock;
}

/**
 * Builds one school's selling use cases: prices, coupons, bundles, the payment methods a course or
 * bundle offers, and checkout.
 * Enrollment never happens here: only a confirmed payment enrolls (`createPaymentConfirmation`).
 *
 * @param dependencies Store, gateways and confirmation.
 * @param dependencies.store The school's prices and orders.
 * @param dependencies.gateways Every configured gateway.
 * @param dependencies.confirmation Enrolls from a confirmed payment.
 * @param dependencies.clock The current time, for coupon expiry and when refunds happen.
 * @returns Pricing, coupon, bundle, offer and checkout operations.
 * @example
 * const commerce = createCommerceService({ store: createCommerceStore(db, schoolId), gateways, confirmation, clock });
 */
export function createCommerceService({ store, gateways, confirmation, clock }: CommerceDependencies) {
  /**
   * Lists the methods that can charge a price.
   *
   * @param price The price.
   * @returns The methods, in the configured order.
   */
  function methodsFor(price: Price): PaymentMethod[] {
    return gateways.filter((gateway) => gateway.supports(price.currency)).map((gateway) => gateway.method);
  }

  /**
   * Prices a course with the coupon the student typed.
   *
   * @param price The course's price.
   * @param code The coupon code, normalized to upper case.
   * @returns The coupon and its discount.
   * @throws {InvalidCouponError} When the school has no such coupon, or it cannot be used on this price.
   */
  async function discountFor(price: Price, code: string): Promise<{ coupon: Coupon; discount: Discount }> {
    const coupon = await store.findCoupon(code);
    if (!coupon) throw new InvalidCouponError("unknown");
    return { coupon, discount: applyCoupon(price, coupon, clock.now()) };
  }

  /**
   * Describes how something with a price can be bought.
   *
   * @param price Its price, or null when it is not for sale.
   * @param query The coupon code, if any.
   * @returns The price, the methods that take its currency, and the coupon's discount.
   * @throws {InvalidCouponError} When the coupon is unknown or cannot be used on the price.
   */
  async function offerFor(price: Price | null, query: OfferQuery): Promise<Offer> {
    if (!price) return { price: null, methods: [], discount: null };
    const discount = query.coupon ? (await discountFor(price, query.coupon)).discount : null;
    return { price, methods: methodsFor(price), discount };
  }

  /**
   * Creates a pending order for a course or bundle at its price less any coupon, split across its
   * courses, and asks the chosen gateway to take the payment.
   *
   * @param buyer Who is paying.
   * @param product What is bought.
   * @param input The payment method, coupon code and the buyer's language.
   * @param urls Where the gateway sends the student back.
   * @returns The order id and what the browser does next.
   * @throws {PaymentMethodUnavailableError} When the method is not configured or does not take the currency.
   * @throws {AlreadyEnrolledError} When the student already has every course sold.
   * @throws {InvalidCouponError} When the coupon is unknown or cannot be used on the price.
   */
  async function startOrder(
    buyer: Buyer,
    product: Product,
    input: Pick<CheckoutInput, "method" | "couponCode" | "locale">,
    urls: ReturnUrls,
  ): Promise<{ orderId: string; payment: PaymentStart }> {
    const gateway = gateways.find(({ method }) => method === input.method);
    if (!gateway?.supports(product.price.currency)) throw new PaymentMethodUnavailableError();
    const owned = await store.enrolledCourseIds(buyer.userId, product.courseIds);
    if (owned.length === product.courseIds.length) throw new AlreadyEnrolledError();
    const coupon = input.couponCode ? await discountFor(product.price, input.couponCode) : null;
    const amount = coupon?.discount.total ?? product.price.amount;

    const { id: orderId } = await store.createOrder({
      userId: buyer.userId,
      price: product.price,
      lines: splitAcrossCourses(amount, product.courseIds, product.price.currency),
      bundleId: product.bundleId,
      couponId: coupon?.coupon.id ?? null,
      method: gateway.method,
      locale: input.locale,
    });
    const payment = await gateway.startPayment({
      orderId,
      amount,
      currency: product.price.currency,
      description: product.title,
      customerEmail: buyer.email,
      ...urls(orderId),
    });
    await store.setProviderRef(orderId, payment.providerRef);
    return { orderId, payment };
  }

  /**
   * Checks that every course of a bundle is the school's.
   *
   * @param courseIds The bundle's courses.
   * @throws {UnknownBundleCourseError} When one is not.
   */
  async function assertSchoolCourses(courseIds: string[]): Promise<void> {
    if ((await store.findCourseIds(courseIds)).length !== courseIds.length) throw new UnknownBundleCourseError();
  }

  /**
   * Loads a bundle students can see.
   *
   * @param slug The bundle's slug.
   * @returns The published bundle.
   * @throws {BundleNotFoundError} When the school has no published bundle with that slug.
   */
  async function publishedBundle(slug: string): Promise<Bundle> {
    const bundle = await store.findBundle(slug);
    if (bundle?.status !== "published") throw new BundleNotFoundError();
    return bundle;
  }

  return {
    /**
     * Sets a course's price; earlier prices stay on past orders.
     *
     * @param courseId The course.
     * @param price Amount in minor units and currency.
     * @returns The new price.
     * @throws {CourseNotFoundError} When the school has no such course.
     */
    async setPrice(courseId: string, price: PriceInput): Promise<Price> {
      const saved = await store.setPrice(courseId, price);
      if (!saved) throw new CourseNotFoundError();
      return saved;
    },

    /**
     * Creates a coupon the school's students can use at checkout.
     *
     * @param coupon Its code, discount, expiry and usage limit.
     * @returns The coupon, not yet used.
     * @throws {CouponCodeTakenError} When the school already has a coupon with the code.
     */
    async createCoupon(coupon: CouponInput): Promise<Coupon> {
      const created = await store.createCoupon(coupon);
      if (!created) throw new CouponCodeTakenError();
      return created;
    },

    /**
     * Lists the school's coupons with how often each was used.
     *
     * @returns The coupons, newest first.
     */
    listCoupons(): Promise<Coupon[]> {
      return store.listCoupons();
    },

    /**
     * Deletes a coupon so it can no longer be used; orders that used it keep their price.
     *
     * @param couponId The coupon.
     * @throws {CouponNotFoundError} When the school has no such coupon.
     */
    async deleteCoupon(couponId: string): Promise<void> {
      if (!(await store.deleteCoupon(couponId))) throw new CouponNotFoundError();
    },

    /**
     * Describes how a published course can be bought: its price, the methods that take its currency,
     * and, when the student typed a coupon, what it takes off.
     *
     * @param slug The course's slug.
     * @param query The coupon code, if any.
     * @returns The price (null when not for sale), the payment methods (empty without a price) and the discount (null without a coupon or a price).
     * @throws {CourseNotFoundError} When the school has no published course with that slug.
     * @throws {InvalidCouponError} When the coupon is unknown or cannot be used on the course's price.
     */
    async getOffer(slug: string, query: OfferQuery = {}): Promise<Offer> {
      const course = await store.findCourse(slug);
      if (!course?.isPublished) throw new CourseNotFoundError();
      return offerFor(course.price, query);
    },

    /**
     * Starts buying a course: creates a pending order at the price less any coupon, and asks the
     * chosen gateway to take the payment.
     *
     * @param buyer Who is paying.
     * @param buyer.userId Their user id.
     * @param buyer.email Their email, for the gateway's receipt.
     * @param input The course, payment method, coupon code and the buyer's language.
     * @param urls Where the gateway sends the student back, given the new order's id.
     * @returns The order id and what the browser does next.
     * @throws {CourseNotFoundError} When the school has no published course with that slug.
     * @throws {CourseNotForSaleError} When the course has no price.
     * @throws {AlreadyEnrolledError} When the student already has the course.
     * @throws {PaymentMethodUnavailableError} When the method is not configured or does not take the currency.
     * @throws {InvalidCouponError} When the coupon is unknown or cannot be used on the course's price.
     */
    async checkout(buyer: Buyer, input: CheckoutInput, urls: ReturnUrls): Promise<{ orderId: string; payment: PaymentStart }> {
      const course = await store.findCourse(input.courseSlug);
      if (!course?.isPublished) throw new CourseNotFoundError();
      if (!course.price) throw new CourseNotForSaleError();
      return startOrder(buyer, { title: course.title, price: course.price, courseIds: [course.id], bundleId: null }, input, urls);
    },

    /**
     * Lists the school's bundles, drafts included, for the dashboard.
     *
     * @returns The bundles, newest first.
     */
    listBundles(): Promise<Bundle[]> {
      return store.listBundles();
    },

    /**
     * Loads a bundle for the dashboard, draft or published.
     *
     * @param slug The bundle's slug.
     * @returns The bundle.
     * @throws {BundleNotFoundError} When the school has no bundle with that slug.
     */
    async getBundle(slug: string): Promise<Bundle> {
      const bundle = await store.findBundle(slug);
      if (!bundle) throw new BundleNotFoundError();
      return bundle;
    },

    /**
     * Loads a published bundle for its sales page.
     *
     * @param slug The bundle's slug.
     * @returns The bundle.
     * @throws {BundleNotFoundError} When the school has no published bundle with that slug.
     */
    getPublishedBundle(slug: string): Promise<Bundle> {
      return publishedBundle(slug);
    },

    /**
     * Creates a draft bundle of the school's courses, with a slug made from its title.
     *
     * @param input Its title and courses.
     * @returns The bundle, without a price.
     * @throws {UnknownBundleCourseError} When a course is not the school's.
     */
    async createBundle(input: CreateBundleInput): Promise<Bundle> {
      await assertSchoolCourses(input.courseIds);
      const slug = uniqueSlug(input.title, await store.listBundleSlugs(), FALLBACK_BUNDLE_SLUG);
      return store.createBundle({ title: input.title, slug, courseIds: input.courseIds });
    },

    /**
     * Changes a bundle's title, description, status or courses. The slug stays, so links keep working.
     *
     * @param bundleId The bundle.
     * @param changes The fields to change.
     * @returns The updated bundle.
     * @throws {UnknownBundleCourseError} When a new course is not the school's.
     * @throws {BundleNotFoundError} When the school has no such bundle.
     */
    async updateBundle(bundleId: string, changes: UpdateBundleInput): Promise<Bundle> {
      if (changes.courseIds) await assertSchoolCourses(changes.courseIds);
      const bundle = await store.updateBundle(bundleId, changes);
      if (!bundle) throw new BundleNotFoundError();
      return bundle;
    },

    /**
     * Sets a bundle's price; earlier prices stay on past orders.
     *
     * @param bundleId The bundle.
     * @param price Amount in minor units and currency.
     * @returns The new price.
     * @throws {BundleNotFoundError} When the school has no such bundle.
     */
    async setBundlePrice(bundleId: string, price: PriceInput): Promise<Price> {
      const saved = await store.setBundlePrice(bundleId, price);
      if (!saved) throw new BundleNotFoundError();
      return saved;
    },

    /**
     * Describes how a published bundle can be bought, like `getOffer` for a course.
     *
     * @param slug The bundle's slug.
     * @param query The coupon code, if any.
     * @returns The price (null when not for sale), the payment methods and the discount.
     * @throws {BundleNotFoundError} When the school has no published bundle with that slug.
     * @throws {InvalidCouponError} When the coupon is unknown or cannot be used on the bundle's price.
     */
    async getBundleOffer(slug: string, query: OfferQuery = {}): Promise<Offer> {
      return offerFor((await publishedBundle(slug)).price, query);
    },

    /**
     * Starts buying a bundle: one pending order for all its courses, its price less any coupon split
     * across them. The confirmed payment enrolls the buyer in every course.
     *
     * @param buyer Who is paying.
     * @param buyer.userId Their user id.
     * @param buyer.email Their email, for the gateway's receipt.
     * @param input The bundle, payment method, coupon code and the buyer's language.
     * @param urls Where the gateway sends the student back, given the new order's id.
     * @returns The order id and what the browser does next.
     * @throws {BundleNotFoundError} When the school has no published bundle with that slug.
     * @throws {CourseNotForSaleError} When the bundle has no price.
     * @throws {AlreadyEnrolledError} When the student already has every course of the bundle.
     * @throws {PaymentMethodUnavailableError} When the method is not configured or does not take the currency.
     * @throws {InvalidCouponError} When the coupon is unknown or cannot be used on the bundle's price.
     */
    async checkoutBundle(buyer: Buyer, input: BundleCheckoutInput, urls: ReturnUrls): Promise<{ orderId: string; payment: PaymentStart }> {
      const bundle = await publishedBundle(input.bundleSlug);
      if (!bundle.price) throw new CourseNotForSaleError();
      const courseIds = bundle.courses.map((course) => course.id);
      return startOrder(buyer, { title: bundle.title, price: bundle.price, courseIds, bundleId: bundle.id }, input, urls);
    },

    /**
     * Reads an order for its buyer, e.g. while a status page waits for the payment. A pending order
     * whose gateway can be asked (PayWay, Bakong) is checked with it, and enrolled once it is paid.
     *
     * @param orderId The order.
     * @param userId The signed-in user.
     * @returns The order, up to date with the gateway.
     * @throws {OrderNotFoundError} When the user has no such order in this school.
     */
    async getOrder(orderId: string, userId: string): Promise<OrderSummary> {
      const order = await store.findOrder(orderId, userId);
      if (!order) throw new OrderNotFoundError();
      const gateway = gateways.find(({ method }) => method === order.method);
      if (order.status !== "pending" || !order.providerRef || !gateway?.checkPayment) return order;
      const check = await gateway.checkPayment(order.providerRef);
      if (check !== "paid") return order;
      await confirmation.confirm(order.method, order.providerRef);
      return { ...order, status: "paid" };
    },

    /**
     * Refunds a paid order in full and takes back what it gave: through its gateway when the gateway
     * can refund (Stripe), or, for gateways that cannot (KHQR, PayWay), once staff confirm they paid the
     * student back themselves.
     *
     * @param orderId The order.
     * @param input Whether staff already refunded by hand.
     * @param input.isRefundedByHand Staff paid the student back outside the platform.
     * @throws {OrderNotFoundError} When the school has no such order.
     * @throws {OrderNotRefundableError} When the order is not paid, or stopped being paid meanwhile.
     * @throws {RefundByHandRequiredError} When the gateway cannot refund and staff have not refunded by hand.
     * @throws {Error} When the gateway refuses the refund; the order stays paid.
     */
    async refundOrder(orderId: string, { isRefundedByHand }: RefundInput): Promise<void> {
      const order = await store.findSchoolOrder(orderId);
      if (!order) throw new OrderNotFoundError();
      if (order.status !== "paid" || !order.providerRef) throw new OrderNotRefundableError();
      const gateway = gateways.find(({ method }) => method === order.method);
      if (gateway?.refund) await gateway.refund(order.providerRef);
      else if (!isRefundedByHand) throw new RefundByHandRequiredError();
      const isRefunded = await store.refundOrder(orderId, { at: clock.now(), isRefundedByHand: !gateway?.refund });
      if (!isRefunded) throw new OrderNotRefundableError();
    },
  };
}

/**
 * Builds the one path to enrollment: a gateway's confirmed payment marks the order paid and
 * enrolls the buyer, exactly once however often the gateway repeats itself.
 *
 * @param store Confirms payments across schools.
 * @returns The confirmation operation.
 * @example
 * await createPaymentConfirmation(createPaymentConfirmationStore(db)).confirm("stripe", session.id);
 */
export function createPaymentConfirmation(store: PaymentConfirmationStore) {
  return {
    /**
     * Records a payment the gateway has confirmed (webhook or status check).
     *
     * @param method The gateway that confirmed it.
     * @param providerRef The gateway's reference for the payment.
     * @returns The order and whether this call is the one that marked it paid.
     * @throws {UnknownPaymentError} When no order has the reference.
     */
    async confirm(method: PaymentMethod, providerRef: string) {
      const result = await store.confirm(method, providerRef);
      if (!result) throw new UnknownPaymentError();
      return result;
    },
  };
}

/** One school's selling use cases. */
export type CommerceService = ReturnType<typeof createCommerceService>;
/** The payment confirmation use case. */
export type PaymentConfirmation = ReturnType<typeof createPaymentConfirmation>;
