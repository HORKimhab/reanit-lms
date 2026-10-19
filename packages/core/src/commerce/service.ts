import type { Clock } from "../auth";
import { CourseNotFoundError } from "../catalog";
import { applyCoupon } from "./coupons";
import {
  AlreadyEnrolledError,
  CouponCodeTakenError,
  CouponNotFoundError,
  CourseNotForSaleError,
  InvalidCouponError,
  OrderNotFoundError,
  PaymentMethodUnavailableError,
  UnknownPaymentError,
} from "./errors";
import type { Coupon, CommerceStore, Discount, OrderSummary, PaymentConfirmationStore, PaymentGateway, PaymentStart, Price } from "./ports";
import type { CheckoutInput, CouponInput, OfferQuery, PaymentMethod, PriceInput } from "./rules";

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
 * Builds one school's selling use cases: prices, the payment methods a course offers, and checkout.
 * Enrollment never happens here: only a confirmed payment enrolls (`createPaymentConfirmation`).
 *
 * @param dependencies Store, gateways and confirmation.
 * @param dependencies.store The school's prices and orders.
 * @param dependencies.gateways Every configured gateway.
 * @param dependencies.confirmation Enrolls from a confirmed payment.
 * @param dependencies.clock The current time, for coupon expiry.
 * @returns Pricing, coupon, offer and checkout operations.
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
    async getOffer(slug: string, query: OfferQuery = {}): Promise<{ price: Price | null; methods: PaymentMethod[]; discount: Discount | null }> {
      const course = await store.findCourse(slug);
      if (!course?.isPublished) throw new CourseNotFoundError();
      if (!course.price) return { price: null, methods: [], discount: null };
      const discount = query.coupon ? (await discountFor(course.price, query.coupon)).discount : null;
      return { price: course.price, methods: methodsFor(course.price), discount };
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
    async checkout(
      buyer: { userId: string; email: string },
      input: CheckoutInput,
      urls: (orderId: string) => { successUrl: string; cancelUrl: string },
    ): Promise<{ orderId: string; payment: PaymentStart }> {
      const course = await store.findCourse(input.courseSlug);
      if (!course?.isPublished) throw new CourseNotFoundError();
      if (!course.price) throw new CourseNotForSaleError();
      const gateway = gateways.find(({ method }) => method === input.method);
      if (!gateway?.supports(course.price.currency)) throw new PaymentMethodUnavailableError();
      if (await store.isEnrolled(buyer.userId, course.id)) throw new AlreadyEnrolledError();
      const coupon = input.couponCode ? await discountFor(course.price, input.couponCode) : null;
      const amount = coupon?.discount.total ?? course.price.amount;

      const { id: orderId } = await store.createOrder({
        userId: buyer.userId,
        courseId: course.id,
        price: course.price,
        amount,
        couponId: coupon?.coupon.id ?? null,
        method: gateway.method,
        locale: input.locale,
      });
      const payment = await gateway.startPayment({
        orderId,
        amount,
        currency: course.price.currency,
        description: course.title,
        customerEmail: buyer.email,
        ...urls(orderId),
      });
      await store.setProviderRef(orderId, payment.providerRef);
      return { orderId, payment };
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
