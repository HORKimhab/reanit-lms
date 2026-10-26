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
  OfflinePaymentClosedError,
  OrderNotFoundError,
  OrderNotRefundableError,
  PaymentMethodUnavailableError,
  RefundByHandRequiredError,
  SubscriptionNotFoundError,
  SubscriptionNotRenewableError,
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
  PaymentMatch,
  PaymentStart,
  Price,
  SubscriptionRecord,
} from "./ports";
import {
  ONE_TIME_ONLY_METHODS,
  type BundleCheckoutInput,
  type CheckoutInput,
  type CouponInput,
  type CreateBundleInput,
  type OfferQuery,
  type OfflinePaymentInput,
  type PaymentMethod,
  type PriceInput,
  type RefundInput,
  type RenewInput,
  type UpdateBundleInput,
} from "./rules";
import { currentStatus, renewSubscription } from "./subscriptions";

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

/** How one order is paid: the method, the buyer's language, the coupon and amount, and the subscription period it pays, if any. */
type OrderTerms = Pick<CheckoutInput, "method" | "locale"> & { couponId: string | null; amount: number; subscriptionId: string | null };

/** Offline QR orders staff may still confirm or reject: the student has not paid, has said they paid, or staff rejected it by mistake. */
const OPEN_OFFLINE_STATUSES = new Set(["pending", "awaiting_confirmation", "failed"]);

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
   * Lists the methods that can charge a price. A one-time price takes every gateway that takes its
   * currency. A subscription or payment plan is paid period by period without saved cards: by the
   * school's own payment QR first (when it uploaded one), then by the gateways that are not one-time only.
   *
   * @param price The price.
   * @returns The methods, the default first.
   */
  async function methodsFor(price: Price): Promise<PaymentMethod[]> {
    const isOneTime = price.billing.kind === "one_time";
    const gatewayMethods = gateways
      .filter((gateway) => gateway.supports(price.currency) && (isOneTime || !ONE_TIME_ONLY_METHODS.includes(gateway.method)))
      .map((gateway) => gateway.method);
    if (isOneTime || !(await store.hasPaymentQr())) return gatewayMethods;
    return ["offline_qr", ...gatewayMethods];
  }

  /**
   * Checks that a method can charge a price.
   *
   * @param method The chosen method.
   * @param price The price.
   * @throws {PaymentMethodUnavailableError} When it is not configured, does not take the currency, or does not take this kind of price.
   */
  async function assertMethod(method: PaymentMethod, price: Price): Promise<void> {
    if (!(await methodsFor(price)).includes(method)) throw new PaymentMethodUnavailableError();
  }

  /**
   * Prices a course with the coupon the student typed.
   *
   * @param price The course's price.
   * @param code The coupon code, normalized to upper case.
   * @returns The coupon and its discount.
   * @throws {InvalidCouponError} When the school has no such coupon, it cannot be used on this price, or the price is not one-time.
   */
  async function discountFor(price: Price, code: string): Promise<{ coupon: Coupon; discount: Discount }> {
    if (price.billing.kind !== "one_time") throw new InvalidCouponError("one_time_only");
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
    return { price, methods: await methodsFor(price), discount };
  }

  /**
   * Creates a pending order for a product, its amount split across its courses, and starts its
   * payment: the gateway's step, or showing the school's payment QR for an offline payment.
   *
   * @param buyer Who is paying.
   * @param product What is bought.
   * @param terms The method (already checked), language, coupon, amount and subscription.
   * @param urls Where the gateway sends the student back.
   * @returns The order id and what the browser does next.
   */
  async function placeOrder(buyer: Buyer, product: Product, terms: OrderTerms, urls: ReturnUrls): Promise<{ orderId: string; payment: PaymentStart }> {
    const { id: orderId } = await store.createOrder({
      userId: buyer.userId,
      price: product.price,
      lines: splitAcrossCourses(terms.amount, product.courseIds, product.price.currency),
      bundleId: product.bundleId,
      couponId: terms.couponId,
      method: terms.method,
      locale: terms.locale,
      subscriptionId: terms.subscriptionId,
    });
    const gateway = gateways.find(({ method }) => method === terms.method);
    // assertMethod let the method through, so without a gateway it is the school's offline QR.
    if (!gateway) return { orderId, payment: { kind: "offline" } };
    const payment = await gateway.startPayment({
      orderId,
      amount: terms.amount,
      currency: product.price.currency,
      description: product.title,
      customerEmail: buyer.email,
      ...urls(orderId),
    });
    await store.setProviderRef(orderId, payment.providerRef);
    return { orderId, payment };
  }

  /**
   * Starts buying a course or bundle: at its price less any coupon for a one-time price, or as a new
   * subscription's first period for a recurring price or payment plan.
   *
   * @param buyer Who is paying.
   * @param product What is bought.
   * @param input The payment method, coupon code and the buyer's language.
   * @param urls Where the gateway sends the student back.
   * @returns The order id and what the browser does next.
   * @throws {PaymentMethodUnavailableError} When the method cannot charge the price.
   * @throws {AlreadyEnrolledError} When the student already has every course sold.
   * @throws {InvalidCouponError} When the coupon is unknown or cannot be used on the price.
   */
  async function startOrder(
    buyer: Buyer,
    product: Product,
    input: Pick<CheckoutInput, "method" | "couponCode" | "locale">,
    urls: ReturnUrls,
  ): Promise<{ orderId: string; payment: PaymentStart }> {
    await assertMethod(input.method, product.price);
    const owned = await store.enrolledCourseIds(buyer.userId, product.courseIds, clock.now());
    if (owned.length === product.courseIds.length) throw new AlreadyEnrolledError();
    const coupon = input.couponCode ? await discountFor(product.price, input.couponCode) : null;
    const subscription =
      product.price.billing.kind === "one_time" ? null : await store.createSubscription({ userId: buyer.userId, priceId: product.price.id });
    return placeOrder(
      buyer,
      product,
      {
        method: input.method,
        locale: input.locale,
        couponId: coupon?.coupon.id ?? null,
        amount: coupon?.discount.total ?? product.price.amount,
        subscriptionId: subscription?.id ?? null,
      },
      urls,
    );
  }

  /**
   * Finds an offline QR order of the school that staff can still confirm or reject.
   *
   * @param orderId The order.
   * @returns The order.
   * @throws {OrderNotFoundError} When the school has no such order.
   * @throws {OfflinePaymentClosedError} When it is not an offline QR order, or is already paid or refunded.
   */
  async function openOfflineOrder(orderId: string): Promise<OrderSummary> {
    const order = await store.findSchoolOrder(orderId);
    if (!order) throw new OrderNotFoundError();
    if (order.method !== "offline_qr" || !OPEN_OFFLINE_STATUSES.has(order.status)) throw new OfflinePaymentClosedError();
    return order;
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
     * Reads a course's current price, draft or published, for its editor.
     *
     * @param courseId The course.
     * @returns The price, or null when the course has none yet.
     * @throws {CourseNotFoundError} When the school has no such course.
     */
    async getPrice(courseId: string): Promise<Price | null> {
      const found = await store.findCoursePrice(courseId);
      if (!found) throw new CourseNotFoundError();
      return found.price;
    },

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
     * @throws {PaymentMethodUnavailableError} When the method cannot charge the course's price.
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
     * @throws {PaymentMethodUnavailableError} When the method cannot charge the bundle's price.
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
     * whose gateway can be asked (PayWay, Bakong) is checked with it: enrolled once it is paid, failed once the gateway says so.
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
      if (check === "failed") {
        await store.failOrder(order.id);
        return { ...order, status: "failed" };
      }
      if (check !== "paid") return order;
      await confirmation.confirm(gateway.method, order.providerRef);
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
      if (order.status !== "paid") throw new OrderNotRefundableError();
      const gateway = gateways.find(({ method }) => method === order.method);
      // Gateway orders get their reference when payment starts; offline QR orders have none and no gateway.
      const canGatewayRefund = Boolean(gateway?.refund && order.providerRef);
      if (canGatewayRefund) await gateway!.refund!(order.providerRef!);
      else if (!isRefundedByHand) throw new RefundByHandRequiredError();
      const isRefunded = await store.refundOrder(orderId, { at: clock.now(), isRefundedByHand: !canGatewayRefund });
      if (!isRefunded) throw new OrderNotRefundableError();
    },

    /**
     * Pays a subscription's next period or a payment plan's next instalment, at its price; the
     * confirmed payment extends access. A lapsed subscription comes back this way.
     *
     * @param buyer Who is paying.
     * @param buyer.userId Their user id.
     * @param buyer.email Their email, for the gateway's receipt.
     * @param subscriptionId The subscription.
     * @param input The payment method and the buyer's language.
     * @param urls Where the gateway sends the student back, given the new order's id.
     * @returns The order id and what the browser does next.
     * @throws {SubscriptionNotFoundError} When the student has no such subscription in the school.
     * @throws {SubscriptionNotRenewableError} When its first payment is still open, or the plan is paid off.
     * @throws {PaymentMethodUnavailableError} When the method cannot charge the price.
     */
    async renewSubscription(buyer: Buyer, subscriptionId: string, input: RenewInput, urls: ReturnUrls): Promise<{ orderId: string; payment: PaymentStart }> {
      const subscription = await store.findSubscription(subscriptionId, buyer.userId);
      if (!subscription) throw new SubscriptionNotFoundError();
      if (subscription.status === "pending" || subscription.status === "completed") throw new SubscriptionNotRenewableError();
      await assertMethod(input.method, subscription.price);
      const { title, price, courseIds, bundleId } = subscription;
      return placeOrder(buyer, { title, price, courseIds, bundleId }, { ...input, couponId: null, amount: price.amount, subscriptionId }, urls);
    },

    /**
     * Lists the student's subscriptions and payment plans in the school, with where each stands now
     * and the methods its next payment can use.
     *
     * @param userId The signed-in student.
     * @returns Every subscription ever paid, newest first; an active one past its grace period shows as lapsed.
     */
    async listMySubscriptions(userId: string): Promise<(SubscriptionRecord & { methods: PaymentMethod[] })[]> {
      const now = clock.now();
      const subscriptions = await store.listSubscriptions(userId);
      return Promise.all(
        subscriptions.map(async (subscription) => ({ ...subscription, status: currentStatus(subscription, now), methods: await methodsFor(subscription.price) })),
      );
    },

    /**
     * Records the student's word that they paid an offline QR order, with the reference their banking
     * app showed; the order then waits for staff to confirm the money arrived.
     *
     * @param orderId The order.
     * @param userId The signed-in student.
     * @param input The transaction reference.
     * @param input.reference As the banking app showed it.
     * @throws {OrderNotFoundError} When the student has no such order in the school.
     * @throws {OfflinePaymentClosedError} When it is not a pending offline QR order.
     */
    async submitOfflinePayment(orderId: string, userId: string, { reference }: OfflinePaymentInput): Promise<void> {
      if (await store.submitOfflinePayment(orderId, userId, reference)) return;
      if (!(await store.findOrder(orderId, userId))) throw new OrderNotFoundError();
      throw new OfflinePaymentClosedError();
    },

    /**
     * Confirms, for staff, that an offline QR payment arrived: the order is paid and enrolls its buyer
     * through the same confirmation as gateway payments.
     *
     * @param orderId The order.
     * @throws {OrderNotFoundError} When the school has no such order.
     * @throws {OfflinePaymentClosedError} When it is not an offline QR order, or is already paid or refunded.
     */
    async confirmOfflinePayment(orderId: string): Promise<void> {
      await openOfflineOrder(orderId);
      await confirmation.confirmOffline(orderId);
    },

    /**
     * Rejects, for staff, an offline QR payment that never arrived: the order fails and enrolls nobody.
     *
     * @param orderId The order.
     * @throws {OrderNotFoundError} When the school has no such order.
     * @throws {OfflinePaymentClosedError} When it is not an offline QR order still waiting for payment or confirmation.
     */
    async rejectOfflinePayment(orderId: string): Promise<void> {
      await openOfflineOrder(orderId);
      if (!(await store.failOrder(orderId))) throw new OfflinePaymentClosedError();
    },
  };
}

/**
 * Builds the one path to enrollment: a confirmed payment marks the order paid and enrolls the buyer,
 * exactly once however often it is repeated. Gateways confirm their own payments; staff confirm the
 * offline QR payments they found in the school's account. A subscription's payment also moves its
 * period on (`renewSubscription`) and its enrollments' access with it.
 *
 * @param dependencies Store and clock.
 * @param dependencies.store Confirms payments across schools.
 * @param dependencies.clock When a payment is confirmed.
 * @returns The confirmation operations.
 * @example
 * await createPaymentConfirmation({ store: createPaymentConfirmationStore(db), clock }).confirm("stripe", session.id);
 */
export function createPaymentConfirmation({ store, clock }: { store: PaymentConfirmationStore; clock: Clock }) {
  /**
   * Records a confirmed payment.
   *
   * @param payment How to find its order.
   * @returns The order and whether this call is the one that marked it paid.
   * @throws {UnknownPaymentError} When no order matches.
   */
  async function confirmPayment(payment: PaymentMatch) {
    const result = await store.confirm(payment, clock.now(), renewSubscription);
    if (!result) throw new UnknownPaymentError();
    return result;
  }

  return {
    /**
     * Records a payment a gateway has confirmed (webhook or status check).
     *
     * @param method The gateway that confirmed it.
     * @param providerRef The gateway's reference for the payment.
     * @returns The order and whether this call is the one that marked it paid.
     * @throws {UnknownPaymentError} When no order has the reference.
     */
    confirm(method: PaymentGateway["method"], providerRef: string) {
      return confirmPayment({ method, providerRef });
    },

    /**
     * Records an offline QR payment staff found in the school's account; the caller has checked the
     * order is the staff member's school's.
     *
     * @param orderId The order.
     * @returns The order and whether this call is the one that marked it paid.
     * @throws {UnknownPaymentError} When no offline QR order has the id.
     */
    confirmOffline(orderId: string) {
      return confirmPayment({ offlineOrderId: orderId });
    },
  };
}

/** One school's selling use cases. */
export type CommerceService = ReturnType<typeof createCommerceService>;
/** The payment confirmation use case. */
export type PaymentConfirmation = ReturnType<typeof createPaymentConfirmation>;
