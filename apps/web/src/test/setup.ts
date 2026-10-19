import { afterEach, beforeEach, vi } from "vitest";

import { fakeFetch, resetApi, TEST_API_URL } from "./api";
import { cookieJar, requestHeaders } from "./headers";
import { setTestLocale } from "./intl-server";
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
  [...requestHeaders.keys()].forEach((name) => requestHeaders.delete(name));
  setTestLocale("en");
});
