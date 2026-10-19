import { afterEach, beforeEach, vi } from "vitest";

import { fakeFetch, resetApi, TEST_API_URL } from "./api";
import { cookieJar } from "./headers";
import { router, setPathname } from "./navigation";

beforeEach(() => {
  vi.stubEnv("API_URL", TEST_API_URL);
  vi.stubGlobal("fetch", fakeFetch);
});

afterEach(() => {
  setPathname("/");
  Object.values(router).forEach((spy) => spy.mockClear());
  resetApi();
  cookieJar.clear();
});
