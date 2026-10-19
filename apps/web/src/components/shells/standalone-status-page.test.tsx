// @vitest-environment node
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { bilingual, StandaloneStatusPage } from "./standalone-status-page";

describe("StandaloneStatusPage", () => {
  it("renders a whole document saying the page is missing, in English and Khmer", () => {
    const html = renderToStaticMarkup(<StandaloneStatusPage kind="notFound" />);

    expect(html).toMatch(/^<html lang="en">.*<body>/);
    expect(html).toContain("404");
    expect(html).toContain("Page not found · រកមិនឃើញទំព័រ");
  });

  it("says something went wrong for errors, with the given actions", () => {
    const html = renderToStaticMarkup(
      <StandaloneStatusPage kind="error">
        <button type="button">{bilingual("retry")}</button>
      </StandaloneStatusPage>,
    );

    expect(html).toContain("500");
    expect(html).toContain("Something went wrong · មានបញ្ហាកើតឡើង");
    expect(html).toContain("Try again · ព្យាយាមម្ដងទៀត");
  });
});
