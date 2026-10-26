import type { DbClient } from "./client";
import { recordSale, reverseSale } from "./daily-stats";
import { Prisma, type PaymentMethod } from "./generated/prisma/client";
import { appendEvent } from "./outbox";
import { PRICE_FIELDS, priceColumns, PRODUCT_FIELDS, productOf, toBilling, toPrice, type Billing, type Currency, type PriceInput } from "./prices";
import { forSchool, inSchoolTransaction, type SchoolTransaction } from "./tenant";

/** Order statuses a confirmation pays: not yet paid, expired or rejected, or waiting for staff to confirm. */
const CONFIRMABLE_STATUSES = ["pending", "failed", "awaiting_confirmation"] as const;
const NEWEST_FIRST = { createdAt: "desc" } as const;
/** Prisma's error code for a unique constraint violation. */
const UNIQUE_VIOLATION = "P2002";

/** A coupon as the creator set it up; matches `CouponInput` in `@reanit/core/commerce`. */
type CouponInput = { code: string; expiresAt: Date | null; maxRedemptions: number | null } & (
  | { kind: "percent"; percentOff: number }
  | { kind: "fixed"; amountOff: number; currency: Currency }
);

/** Coupon columns, with its paid orders counted. */
const COUPON_FIELDS = {
  id: true,
  code: true,
  kind: true,
  percentOff: true,
  amountOff: true,
  currency: true,
  expiresAt: true,
  maxRedemptions: true,
  _count: { select: { orders: { where: { status: "paid" } } } },
} as const;

/** A coupon row as `COUPON_FIELDS` selects it. */
type CouponRow = Prisma.CouponGetPayload<{ select: typeof COUPON_FIELDS }>;

/** Bundle columns with its courses in order and its newest price. */
const BUNDLE_FIELDS = {
  id: true,
  title: true,
  slug: true,
  description: true,
  status: true,
  courses: { orderBy: { position: "asc" }, select: { course: { select: { id: true, title: true, slug: true } } } },
  prices: { orderBy: NEWEST_FIRST, take: 1, select: PRICE_FIELDS },
} as const;

/** A bundle row as `BUNDLE_FIELDS` selects it. */
type BundleRow = Prisma.BundleGetPayload<{ select: typeof BUNDLE_FIELDS }>;

/** Bundle details that can change; matches `UpdateBundleInput` in `@reanit/core/commerce`. */
type BundleChanges = { title?: string; description?: string; status?: "draft" | "published"; courseIds?: string[] };

/**
 * Turns a bundle row into the bundle checkout and the dashboard use.
 *
 * @param row The stored bundle.
 * @param row.courses Its courses, in order.
 * @param row.prices Its newest price, if any.
 * @returns The bundle with its courses in order and its current price.
 */
function toBundle({ courses, prices, ...bundle }: BundleRow) {
  const [price] = prices;
  return { ...bundle, courses: courses.map(({ course }) => course), price: price ? toPrice(price) : null };
}

/**
 * Puts courses in a bundle, in order, in place of the ones it had.
 *
 * @param tx The school's transaction.
 * @param bundle The bundle.
 * @param bundle.schoolId Its school.
 * @param bundle.bundleId Its id.
 * @param courseIds The courses, in display order.
 */
async function setBundleCourses(tx: SchoolTransaction, { schoolId, bundleId }: { schoolId: string; bundleId: string }, courseIds: string[]) {
  await tx.bundleCourse.deleteMany({ where: { bundleId } });
  await tx.bundleCourse.createMany({ data: courseIds.map((courseId, position) => ({ schoolId, bundleId, courseId, position })) });
}

/**
 * Turns a coupon row into the coupon checkout uses; the table's check constraint guarantees each
 * kind has its own fields, so the fallbacks never apply.
 *
 * @param row The stored coupon.
 * @returns The coupon with how many paid orders used it.
 */
function toCoupon(row: CouponRow) {
  const limits = { id: row.id, code: row.code, expiresAt: row.expiresAt, maxRedemptions: row.maxRedemptions, redemptions: row._count.orders };
  return row.kind === "percent"
    ? { ...limits, kind: "percent" as const, percentOff: row.percentOff ?? 0 }
    : { ...limits, kind: "fixed" as const, amountOff: row.amountOff ?? 0, currency: (row.currency ?? "USD") as Currency };
}

/** A subscription's columns with the price it bills, the course or bundle it sells, and the bundle's courses in order. */
const SUBSCRIPTION_FIELDS = {
  id: true,
  status: true,
  paidPeriods: true,
  currentPeriodEnd: true,
  price: { select: { ...PRICE_FIELDS, ...PRODUCT_FIELDS } },
} satisfies Prisma.SubscriptionSelect;

/**
 * Turns a subscription row into what checkout and the student's list use.
 *
 * @param row The stored subscription.
 * @param row.price Its price, with the course or bundle it sells.
 * @returns The subscription with its title, price, courses and bundle.
 */
function toSubscription({ price, ...subscription }: Prisma.SubscriptionGetPayload<{ select: typeof SUBSCRIPTION_FIELDS }>) {
  return { ...subscription, ...productOf(price), price: toPrice(price) };
}

/**
 * One school's prices and orders. Every query goes through the tenant client, so another school's
 * rows are invisible; it satisfies `CommerceStore` from `@reanit/core/commerce`.
 *
 * @param db Unscoped client from `createDbClient`.
 * @param schoolId The school whose catalog this is.
 * @returns The store operations.
 * @throws {z.ZodError} When `schoolId` is not a UUID.
 * @example
 * const commerce = createCommerceService({ store: createCommerceStore(db, school.id), gateways });
 */
export function createCommerceStore(db: DbClient, schoolId: string) {
  const tenant = forSchool(db, schoolId);

  /**
   * Finds one of the school's orders, with its first course.
   *
   * @param where Which order: by id, and by buyer when given.
   * @returns The order, or null when the school has no matching order.
   */
  async function findOrderWhere(where: Prisma.OrderWhereInput) {
    const order = await tenant.order.findFirst({
      where,
      select: {
        id: true,
        status: true,
        totalAmount: true,
        currency: true,
        paymentMethod: true,
        providerRef: true,
        items: { select: { courseId: true }, take: 1 },
      },
    });
    const [item] = order?.items ?? [];
    if (!order || !item) return null;
    return {
      id: order.id,
      status: order.status,
      courseId: item.courseId,
      amount: order.totalAmount,
      currency: order.currency as Currency,
      method: order.paymentMethod,
      providerRef: order.providerRef,
    };
  }

  return {
    /**
     * Loads a course with its current (newest) price.
     *
     * @param slug The course's slug.
     * @returns The course, or null when the school has none with that slug.
     */
    async findCourse(slug: string) {
      const course = await tenant.course.findUnique({
        where: { schoolId_slug: { schoolId, slug } },
        select: { id: true, title: true, status: true, prices: { orderBy: NEWEST_FIRST, take: 1, select: PRICE_FIELDS } },
      });
      if (!course) return null;
      const [price] = course.prices;
      return { id: course.id, title: course.title, isPublished: course.status === "published", price: price ? toPrice(price) : null };
    },

    /**
     * Reads a course's current (newest) price.
     *
     * @param courseId The course.
     * @returns The price (null without one), or null when the school has no such course.
     */
    async findCoursePrice(courseId: string) {
      const course = await tenant.course.findFirst({ where: { id: courseId }, select: { prices: { orderBy: NEWEST_FIRST, take: 1, select: PRICE_FIELDS } } });
      if (!course) return null;
      const [price] = course.prices;
      return { price: price ? toPrice(price) : null };
    },

    /**
     * Gives a course a new price; older prices stay for the orders that used them.
     *
     * @param courseId The course.
     * @param price Amount in minor units, currency and billing.
     * @returns The new price, or null when the school has no such course.
     */
    async setPrice(courseId: string, price: PriceInput) {
      if (!(await tenant.course.findFirst({ where: { id: courseId }, select: { id: true } }))) return null;
      return toPrice(await tenant.price.create({ data: { schoolId, courseId, ...priceColumns(price) }, select: PRICE_FIELDS }));
    },

    /**
     * Lists the courses a user already has among some.
     *
     * @param userId The user.
     * @param courseIds The courses to check.
     * @param at The moment access is checked at.
     * @returns The ones the user is enrolled in and whose access has not ended.
     */
    async enrolledCourseIds(userId: string, courseIds: string[], at: Date) {
      const enrollments = await tenant.enrollment.findMany({
        where: { userId, courseId: { in: courseIds }, OR: [{ expiresAt: null }, { expiresAt: { gt: at } }] },
        select: { courseId: true },
      });
      return enrollments.map((enrollment) => enrollment.courseId);
    },

    /**
     * Lists which of some course ids are this school's courses.
     *
     * @param courseIds The ids.
     * @returns The school's ones.
     */
    async findCourseIds(courseIds: string[]) {
      return (await tenant.course.findMany({ where: { id: { in: courseIds } }, select: { id: true } })).map((course) => course.id);
    },

    /**
     * Creates a pending order with one item per course; the lines' amounts add up to what it charges.
     *
     * @param order The order.
     * @param order.userId The buyer.
     * @param order.price The course's or bundle's price.
     * @param order.price.id Its id.
     * @param order.price.currency ISO code.
     * @param order.lines Each course and its share of the charge, in minor units.
     * @param order.bundleId The bundle bought, or null for a single course.
     * @param order.couponId The coupon used, or null.
     * @param order.method The payment method chosen.
     * @param order.locale The language the buyer checked out in.
     * @param order.subscriptionId The subscription it pays a period of, or null.
     * @param order.platformFee The platform's fee on the sale, in minor units.
     * @returns The order's id.
     */
    createOrder({
      userId,
      price,
      lines,
      bundleId,
      couponId,
      method,
      locale,
      subscriptionId,
      platformFee,
    }: {
      userId: string;
      price: { id: string; currency: Currency };
      lines: { courseId: string; amount: number }[];
      bundleId: string | null;
      couponId: string | null;
      method: PaymentMethod;
      locale: string;
      subscriptionId: string | null;
      platformFee: number;
    }) {
      return inSchoolTransaction(db, schoolId, (tx) =>
        tx.order.create({
          data: {
            schoolId,
            userId,
            totalAmount: lines.reduce((total, line) => total + line.amount, 0),
            currency: price.currency,
            paymentMethod: method,
            locale,
            couponId,
            subscriptionId,
            platformFee,
            // Items carry what was charged for each course, so sales stats count discounts and bundle shares.
            items: {
              create: lines.map(({ courseId, amount }) => ({ schoolId, courseId, bundleId, priceId: price.id, amount, currency: price.currency })),
            },
          },
          select: { id: true },
        }),
      );
    },

    /**
     * Records the gateway's reference for an order, so its confirmation finds it.
     *
     * @param orderId The order.
     * @param providerRef The gateway's reference.
     */
    async setProviderRef(orderId: string, providerRef: string) {
      await tenant.order.updateMany({ where: { id: orderId }, data: { providerRef } });
    },

    /**
     * Reads one of a user's orders.
     *
     * @param orderId The order.
     * @param userId The buyer.
     * @returns The order, or null when the user has no such order in this school.
     */
    findOrder(orderId: string, userId: string) {
      return findOrderWhere({ id: orderId, userId });
    },

    /**
     * Marks an order failed, when its gateway says the payment will not complete or staff found no
     * offline payment; only pending orders and those awaiting confirmation change.
     *
     * @param orderId The order.
     * @returns Whether it changed.
     */
    async failOrder(orderId: string) {
      const { count } = await tenant.order.updateMany({ where: { id: orderId, status: { in: ["pending", "awaiting_confirmation"] } }, data: { status: "failed" } });
      return count > 0;
    },

    /**
     * Records a student's word that they paid their pending offline QR order: it waits for staff with the reference.
     *
     * @param orderId The order.
     * @param userId The student.
     * @param reference The transaction reference their banking app showed.
     * @returns False for any other order.
     */
    async submitOfflinePayment(orderId: string, userId: string, reference: string) {
      const { count } = await tenant.order.updateMany({
        where: { id: orderId, userId, paymentMethod: "offline_qr", status: "pending" },
        data: { status: "awaiting_confirmation", paymentReference: reference },
      });
      return count > 0;
    },

    /**
     * Tells whether the school uploaded its payment QR image.
     *
     * @returns Whether it has one.
     */
    async hasPaymentQr() {
      return (await tenant.school.count({ where: { id: schoolId, paymentQrKey: { not: null } } })) > 0;
    },

    /**
     * Starts a subscription, pending until its first payment.
     *
     * @param subscription The buyer and the recurring or payment plan price.
     * @param subscription.userId The buyer.
     * @param subscription.priceId The price.
     * @returns Its id.
     */
    createSubscription({ userId, priceId }: { userId: string; priceId: string }) {
      return tenant.subscription.create({ data: { schoolId, userId, priceId }, select: { id: true } });
    },

    /**
     * Finds one of a user's subscriptions with what it sells.
     *
     * @param subscriptionId The subscription.
     * @param userId The user.
     * @returns The subscription, or null when the user has no such subscription in the school.
     */
    async findSubscription(subscriptionId: string, userId: string) {
      const row = await tenant.subscription.findFirst({ where: { id: subscriptionId, userId }, select: SUBSCRIPTION_FIELDS });
      return row && toSubscription(row);
    },

    /**
     * Lists a user's subscriptions that were ever paid.
     *
     * @param userId The user.
     * @returns The subscriptions, newest first.
     */
    async listSubscriptions(userId: string) {
      const rows = await tenant.subscription.findMany({
        where: { userId, status: { not: "pending" } },
        orderBy: [{ createdAt: "desc" }, { id: "desc" }],
        select: SUBSCRIPTION_FIELDS,
      });
      return rows.map(toSubscription);
    },

    /**
     * Finds any buyer's order in the school, for staff.
     *
     * @param orderId The order.
     * @returns The order, or null when the school has no such order.
     */
    findSchoolOrder(orderId: string) {
      return findOrderWhere({ id: orderId });
    },

    /**
     * Refunds a paid order in one transaction: marks it refunded, revokes the enrollments it gave,
     * takes its items out of the day's sales they were counted in, and records `OrderRefunded`.
     *
     * @param orderId The order.
     * @param refund When it was refunded, and whether staff paid the student back by hand.
     * @param refund.at When.
     * @param refund.isRefundedByHand Whether by hand.
     * @returns False when the order is not paid (any more), so nothing changed.
     */
    refundOrder(orderId: string, { at, isRefundedByHand }: { at: Date; isRefundedByHand: boolean }) {
      return inSchoolTransaction(db, schoolId, async (tx) => {
        // A refund running at the same time waits for this row, then finds it no longer paid.
        const { count } = await tx.order.updateMany({ where: { id: orderId, status: "paid" }, data: { status: "refunded", refundedAt: at, isRefundedByHand } });
        if (count === 0) return false;
        const order = await tx.order.findUniqueOrThrow({ where: { id: orderId }, select: { userId: true, paidAt: true } });
        // Confirmation sets paidAt whenever it marks an order paid.
        const paidAt = order.paidAt!;
        const items = await tx.orderItem.findMany({ where: { orderId }, select: { courseId: true, amount: true, currency: true } });
        await tx.enrollment.deleteMany({ where: { orderId } });
        for (const item of items) await reverseSale(tx, { schoolId, ...item, at: paidAt });
        await appendEvent(tx, {
          type: "OrderRefunded",
          schoolId,
          payload: { orderId, userId: order.userId, courseIds: items.map((item) => item.courseId), isRefundedByHand },
        });
        return true;
      });
    },

    /**
     * Creates a coupon.
     *
     * @param coupon Its code (upper case), discount, expiry and usage limit.
     * @returns The coupon, or null when the school already has one with the code.
     */
    async createCoupon(coupon: CouponInput) {
      const discount =
        coupon.kind === "percent" ? { percentOff: coupon.percentOff } : { amountOff: coupon.amountOff, currency: coupon.currency };
      try {
        return toCoupon(
          await tenant.coupon.create({
            data: { schoolId, code: coupon.code, kind: coupon.kind, expiresAt: coupon.expiresAt, maxRedemptions: coupon.maxRedemptions, ...discount },
            select: COUPON_FIELDS,
          }),
        );
      } catch (error) {
        if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === UNIQUE_VIOLATION) return null;
        throw error;
      }
    },

    /**
     * Lists the school's coupons with their paid orders counted.
     *
     * @returns The coupons, newest first.
     */
    async listCoupons() {
      return (await tenant.coupon.findMany({ orderBy: NEWEST_FIRST, select: COUPON_FIELDS })).map(toCoupon);
    },

    /**
     * Finds a coupon by its code.
     *
     * @param code The upper-case code.
     * @returns The coupon, or null when the school has none with the code.
     */
    async findCoupon(code: string) {
      const coupon = await tenant.coupon.findUnique({ where: { schoolId_code: { schoolId, code } }, select: COUPON_FIELDS });
      return coupon && toCoupon(coupon);
    },

    /**
     * Deletes a coupon; its orders keep their amounts and lose the link.
     *
     * @param couponId The coupon.
     * @returns False when the school has no such coupon.
     */
    async deleteCoupon(couponId: string) {
      return (await tenant.coupon.deleteMany({ where: { id: couponId } })).count > 0;
    },

    /**
     * Lists the school's bundles, drafts included.
     *
     * @returns The bundles, newest first.
     */
    async listBundles() {
      return (await tenant.bundle.findMany({ orderBy: NEWEST_FIRST, select: BUNDLE_FIELDS })).map(toBundle);
    },

    /**
     * Loads a bundle by slug.
     *
     * @param slug The bundle's slug.
     * @returns The bundle, or null when the school has none with that slug.
     */
    async findBundle(slug: string) {
      const bundle = await tenant.bundle.findUnique({ where: { schoolId_slug: { schoolId, slug } }, select: BUNDLE_FIELDS });
      return bundle && toBundle(bundle);
    },

    /**
     * Lists the slugs the school's bundles use, to pick a free one.
     *
     * @returns The slugs.
     */
    async listBundleSlugs() {
      return (await tenant.bundle.findMany({ select: { slug: true } })).map((bundle) => bundle.slug);
    },

    /**
     * Creates a draft bundle of the school's courses.
     *
     * @param bundle The bundle.
     * @param bundle.title Its title.
     * @param bundle.slug Its free slug.
     * @param bundle.courseIds Its courses, in order; the caller checked they are the school's.
     * @returns The bundle, without a price.
     */
    createBundle({ title, slug, courseIds }: { title: string; slug: string; courseIds: string[] }) {
      return inSchoolTransaction(db, schoolId, async (tx) => {
        const { id: bundleId } = await tx.bundle.create({ data: { schoolId, title, slug }, select: { id: true } });
        await setBundleCourses(tx, { schoolId, bundleId }, courseIds);
        return toBundle(await tx.bundle.findUniqueOrThrow({ where: { id: bundleId }, select: BUNDLE_FIELDS }));
      });
    },

    /**
     * Changes a bundle's details; new courses replace the old ones, in their new order.
     *
     * @param bundleId The bundle.
     * @param changes The fields to change.
     * @param changes.courseIds New courses in order; the caller checked they are the school's.
     * @returns The bundle, or null when the school has no such bundle.
     */
    updateBundle(bundleId: string, { courseIds, ...fields }: BundleChanges) {
      return inSchoolTransaction(db, schoolId, async (tx) => {
        const { count } = await tx.bundle.updateMany({ where: { id: bundleId }, data: fields });
        if (count === 0) return null;
        if (courseIds) await setBundleCourses(tx, { schoolId, bundleId }, courseIds);
        return toBundle(await tx.bundle.findUniqueOrThrow({ where: { id: bundleId }, select: BUNDLE_FIELDS }));
      });
    },

    /**
     * Gives a bundle a new price; older prices stay for the orders that used them.
     *
     * @param bundleId The bundle.
     * @param price Amount in minor units, currency and billing.
     * @returns The new price, or null when the school has no such bundle.
     */
    async setBundlePrice(bundleId: string, price: PriceInput) {
      if (!(await tenant.bundle.findFirst({ where: { id: bundleId }, select: { id: true } }))) return null;
      return toPrice(await tenant.price.create({ data: { schoolId, bundleId, ...priceColumns(price) }, select: PRICE_FIELDS }));
    },
  };
}

/** How a confirmation finds its order; matches `PaymentMatch` in `@reanit/core/commerce`. */
type PaymentMatch = { method: Exclude<PaymentMethod, "offline_qr">; providerRef: string } | { offlineOrderId: string };

/** A subscription's terms and what one paid period changes; match `SubscriptionTerms`, `SubscriptionChange` and `RenewSubscription` in `@reanit/core/commerce`. */
type RenewSubscription = (
  terms: { billing: Exclude<Billing, { kind: "one_time" }>; paidPeriods: number; currentPeriodEnd: Date | null },
  paidAt: Date,
) => { paidPeriods: number; currentPeriodEnd: Date; status: "active" | "completed"; accessUntil: Date | null };

/**
 * Applies a paid period to a subscription, inside the payment's transaction. Touching the row first
 * locks it, so two payments of the same subscription confirmed at once apply one after the other.
 *
 * @param tx The school's transaction.
 * @param subscriptionId The subscription.
 * @param at When the payment was confirmed.
 * @param renew Computes the new period from the current one.
 * @returns What changed: the paid periods and the access end.
 */
async function applyPaidPeriod(tx: SchoolTransaction, subscriptionId: string, at: Date, renew: RenewSubscription) {
  const subscription = await tx.subscription.update({
    where: { id: subscriptionId },
    data: { updatedAt: at },
    select: { paidPeriods: true, currentPeriodEnd: true, price: { select: { kind: true, interval: true, installments: true } } },
  });
  // Subscriptions are only made for recurring and payment plan prices.
  const billing = toBilling(subscription.price) as Exclude<Billing, { kind: "one_time" }>;
  const change = renew({ billing, paidPeriods: subscription.paidPeriods, currentPeriodEnd: subscription.currentPeriodEnd }, at);
  await tx.subscription.update({
    where: { id: subscriptionId },
    data: { status: change.status, paidPeriods: change.paidPeriods, currentPeriodEnd: change.currentPeriodEnd },
  });
  return change;
}

/**
 * Confirms payments across schools: finds the order by the gateway's reference (which is unique), or
 * by id for an offline QR payment staff checked, then marks it paid and enrolls its buyer inside that
 * school's tenant transaction. It satisfies `PaymentConfirmationStore` from `@reanit/core/commerce`.
 *
 * @param db Unscoped client from `createDbClient`.
 * @returns The store operations.
 * @example
 * const confirmation = createPaymentConfirmation({ store: createPaymentConfirmationStore(db), clock });
 */
export function createPaymentConfirmationStore(db: DbClient) {
  return {
    /**
     * Marks an order paid, enrolls its buyer, counts the sale in the daily stats and records the event
     * in the outbox, once. Concurrent confirmations of the same order are safe: only the one that moves it
     * out of `pending`, `awaiting_confirmation` or `failed` (expired, or rejected by staff) enrolls. A
     * subscription's order also moves its period on, and its enrollments last until the new access end;
     * its first payment records `OrderPaid`, later ones `SubscriptionRenewed`.
     *
     * @param payment How to find the order: the gateway and its reference, or an offline QR order's id.
     * @param at When the payment was confirmed.
     * @param renew Computes a subscription's new period.
     * @returns The order and whether this call paid it, or null when no order matches.
     */
    async confirm(payment: PaymentMatch, at: Date, renew: RenewSubscription) {
      const where: Prisma.OrderWhereInput =
        "offlineOrderId" in payment ? { id: payment.offlineOrderId, paymentMethod: "offline_qr" } : { providerRef: payment.providerRef, paymentMethod: payment.method };
      const order = await db.order.findFirst({ where, select: { id: true, schoolId: true, userId: true, subscriptionId: true } });
      if (!order) return null;
      return inSchoolTransaction(db, order.schoolId, async (tx) => {
        const { count } = await tx.order.updateMany({
          where: { id: order.id, status: { in: [...CONFIRMABLE_STATUSES] } },
          data: { status: "paid", paidAt: at },
        });
        if (count === 0) return { orderId: order.id, isNewlyPaid: false };
        const change = order.subscriptionId ? await applyPaidPeriod(tx, order.subscriptionId, at, renew) : null;
        const expiresAt = change?.accessUntil ?? null;
        const items = await tx.orderItem.findMany({ where: { orderId: order.id }, select: { courseId: true, amount: true, currency: true } });
        for (const { courseId, amount, currency } of items) {
          await tx.enrollment.upsert({
            where: { userId_courseId: { userId: order.userId, courseId } },
            create: { schoolId: order.schoolId, userId: order.userId, courseId, orderId: order.id, source: "purchase", expiresAt },
            update: { expiresAt },
          });
          await recordSale(tx, { schoolId: order.schoolId, courseId, amount, currency, at });
        }
        const courseIds = items.map((item) => item.courseId);
        if (change && order.subscriptionId && change.paidPeriods > 1) {
          await appendEvent(tx, {
            type: "SubscriptionRenewed",
            schoolId: order.schoolId,
            payload: { subscriptionId: order.subscriptionId, orderId: order.id, userId: order.userId, courseIds, accessUntil: expiresAt?.toISOString() ?? null },
          });
        } else {
          await appendEvent(tx, { type: "OrderPaid", schoolId: order.schoolId, payload: { orderId: order.id, userId: order.userId, courseIds } });
        }
        return { orderId: order.id, isNewlyPaid: true };
      });
    },
  };
}
