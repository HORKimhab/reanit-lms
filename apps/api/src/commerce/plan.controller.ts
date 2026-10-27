import { Body, Controller, Get, Inject, Param, Post } from "@nestjs/common";
import { ApiCreatedResponse, ApiOkResponse } from "@nestjs/swagger";
import type { AuthUser } from "@reanit/core/auth";
import { CREATOR_PLANS, PLAN_TERMS } from "@reanit/core/schools";
import { ENV } from "@reanit/nest";

import { CurrentUser, Public } from "../auth/auth.decorators";
import type { Env } from "../config/env";
import { CurrentSchool, Roles, type StaffSchool } from "../schools/schools.decorators";
import {
  PlanCheckoutBody,
  PlanCheckoutResponse,
  PlanPaymentParams,
  PlanPaymentResponse,
  PlansResponse,
  SchoolPlanResponse,
  toGatewayStep,
  toPlanTermsResponse,
} from "./commerce.dto";
import { PLAN_BILLING_FOR_SCHOOL, type PlanBillingForSchool } from "./commerce.tokens";

/** Where a creator lands back from paying for a plan. */
const PLAN_PAGE = "/dashboard/plan";

/** Creator plans: what each costs and allows, the school's plan, and paying the platform for one. */
@Controller()
export class PlanController {
  /**
   * Receives the factory for per-school plan billing and the environment.
   *
   * @param billingFor Builds plan billing limited to one school.
   * @param env Validated environment, for the web app's origin in return links.
   */
  constructor(
    @Inject(PLAN_BILLING_FOR_SCHOOL) private readonly billingFor: PlanBillingForSchool,
    @Inject(ENV) private readonly env: Env,
  ) {}

  /**
   * Lists every plan with its prices, fee and limits, for the pricing page.
   *
   * @returns The plans, cheapest first.
   */
  @Public()
  @Get("plans")
  @ApiOkResponse({ type: PlansResponse })
  plans(): PlansResponse {
    return { plans: CREATOR_PLANS.map((plan) => ({ plan, ...toPlanTermsResponse(PLAN_TERMS[plan]) })) };
  }

  /**
   * Reads the caller's school's plan: the one in force, its terms, and what was last paid for.
   *
   * @param school The caller's school.
   * @returns The plan.
   */
  @Get("schools/current/plan")
  @Roles("owner", "admin")
  @ApiOkResponse({ type: SchoolPlanResponse })
  async plan(@CurrentSchool() school: StaffSchool): Promise<SchoolPlanResponse> {
    const { plan, terms, paid, methods } = await this.billingFor(school.id).getPlan();
    return { plan, terms: toPlanTermsResponse(terms), paid: paid && { ...paid, periodEnd: paid.periodEnd.toISOString() }, methods };
  }

  /**
   * Starts paying the platform for a period of a plan. Only the owner pays for the school's plan.
   *
   * @param school The caller's school.
   * @param user The owner.
   * @param body The plan, its period and the payment method.
   * @returns The payment and what the browser does next.
   * @throws {PlanPaymentMethodUnavailableError} When the method cannot take a plan payment (400).
   */
  @Post("schools/current/plan/checkout")
  @Roles("owner")
  @ApiCreatedResponse({ type: PlanCheckoutResponse })
  async checkout(@CurrentSchool() school: StaffSchool, @CurrentUser() user: AuthUser, @Body() body: PlanCheckoutBody): Promise<PlanCheckoutResponse> {
    const page = new URL(PLAN_PAGE, this.env.APP_URL).href;
    const { paymentId, payment } = await this.billingFor(school.id).checkout(user.email, body, (id) => ({ successUrl: `${page}?planPayment=${id}`, cancelUrl: page }));
    return { paymentId, payment: toGatewayStep(payment) };
  }

  /**
   * Reads a plan payment while the owner waits on it; asking checks a pending KHQR or PayWay payment with the gateway.
   *
   * @param school The caller's school.
   * @param params The payment's id.
   * @returns Its status.
   * @throws {PlanPaymentNotFoundError} When the school has no such payment (404).
   */
  @Get("schools/current/plan/payments/:id")
  @Roles("owner", "admin")
  @ApiOkResponse({ type: PlanPaymentResponse })
  async payment(@CurrentSchool() school: StaffSchool, @Param() params: PlanPaymentParams): Promise<PlanPaymentResponse> {
    return { status: await this.billingFor(school.id).getPlanPayment(params.id) };
  }
}
