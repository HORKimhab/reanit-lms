import { Catch, Logger, type ArgumentsHost, type ExceptionFilter } from "@nestjs/common";
import { reportError } from "@reanit/nest";
import type { FastifyReply } from "fastify";

import { PROBLEM_CONTENT_TYPE, toProblem } from "./problem";

/** Answers every error with RFC 9457 problem+json, logging and reporting to Sentry the ones nobody expected. */
@Catch()
export class ProblemDetailsFilter implements ExceptionFilter {
  private readonly logger = new Logger(ProblemDetailsFilter.name);

  /**
   * Writes the problem response for an error thrown while handling a request.
   *
   * @param exception What was thrown.
   * @param host The request's context.
   */
  catch(exception: unknown, host: ArgumentsHost) {
    const { problem, isUnexpected } = toProblem(exception);
    if (isUnexpected) {
      this.logger.error(exception);
      reportError(exception);
    }
    void host.switchToHttp().getResponse<FastifyReply>().status(problem.status).type(PROBLEM_CONTENT_TYPE).send(problem);
  }
}
