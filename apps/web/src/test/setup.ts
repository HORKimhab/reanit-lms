import { afterEach } from "vitest";

import { authService } from "./auth-service";
import { catalogService, getCatalogService } from "./catalog-service";
import { cookieJar } from "./headers";
import { router, setPathname } from "./navigation";
import { schoolService } from "./school-service";

afterEach(() => {
  setPathname("/");
  Object.values(router).forEach((spy) => spy.mockClear());
  [...Object.values(authService), ...Object.values(schoolService), ...Object.values(catalogService)].forEach((stub) =>
    stub.mockReset(),
  );
  getCatalogService.mockClear();
  cookieJar.clear();
});
