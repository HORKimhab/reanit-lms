// Vitest global setup: one throwaway Redis for the integration tests, the version infra/docker-compose.yml runs.
import { GenericContainer } from "testcontainers";
import type { TestProject } from "vitest/node";

const REDIS_IMAGE = "redis:7.4-alpine";
const REDIS_PORT = 6379;

declare module "vitest" {
  export interface ProvidedContext {
    /** Connection URL of the test Redis. */
    redisUrl: string;
  }
}

/**
 * Starts Redis in Docker and hands its URL to the tests.
 *
 * @param project Vitest project, used to `provide` the Redis URL.
 * @returns Teardown that stops the container.
 * @throws {Error} When Docker is unavailable.
 */
export default async function setup(project: TestProject) {
  const container = await new GenericContainer(REDIS_IMAGE).withExposedPorts(REDIS_PORT).start();
  project.provide("redisUrl", `redis://${container.getHost()}:${container.getMappedPort(REDIS_PORT)}`);

  return async () => {
    await container.stop();
  };
}
