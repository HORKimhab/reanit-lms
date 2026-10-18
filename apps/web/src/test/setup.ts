import { afterEach } from "vitest";

import { router, setPathname } from "./navigation";

afterEach(() => {
  setPathname("/");
  Object.values(router).forEach((spy) => spy.mockClear());
});
