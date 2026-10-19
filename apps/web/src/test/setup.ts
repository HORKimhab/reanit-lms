import { afterEach } from "vitest";

import { authService } from "./auth-service";
import { cookieJar } from "./headers";
import { router, setPathname } from "./navigation";

afterEach(() => {
  setPathname("/");
  Object.values(router).forEach((spy) => spy.mockClear());
  Object.values(authService).forEach((stub) => stub.mockReset());
  cookieJar.clear();
});
