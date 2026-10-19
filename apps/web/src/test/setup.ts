import { afterEach } from "vitest";

import { authService } from "./auth-service";
import { cookieJar } from "./headers";
import { router, setPathname } from "./navigation";
import { schoolService } from "./school-service";

afterEach(() => {
  setPathname("/");
  Object.values(router).forEach((spy) => spy.mockClear());
  [...Object.values(authService), ...Object.values(schoolService)].forEach((stub) => stub.mockReset());
  cookieJar.clear();
});
