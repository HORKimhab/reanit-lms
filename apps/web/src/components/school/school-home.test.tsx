import { screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { renderWithIntl } from "@/test/render";
import { PUBLISHED_COURSE, SITE_SCHOOL } from "@/test/site";

import { SchoolHome } from "./school-home";

const SECOND = { ...PUBLISHED_COURSE, id: "c2", slug: "social-media", title: "Social Media" };

describe("SchoolHome", () => {
  it("shows the school's name and a card per course, linking to each sales page", async () => {
    renderWithIntl(<SchoolHome school={SITE_SCHOOL} courses={[PUBLISHED_COURSE, SECOND]} />);
    expect(await screen.findByRole("heading", { level: 1, name: "Angkor Academy" })).toBeInTheDocument();
    expect(screen.getAllByRole("link").map((a) => a.getAttribute("href"))).toEqual([
      "/s/angkor/courses/brand-design-basics",
      "/s/angkor/courses/social-media",
    ]);
    expect(screen.getAllByText("Dara Sok")).toHaveLength(2);
  });

  it("shows the tagline when the school has one", async () => {
    renderWithIntl(<SchoolHome school={{ ...SITE_SCHOOL, tagline: "Practical courses." }} courses={[]} />);
    expect(await screen.findByText("Practical courses.")).toBeInTheDocument();
  });

  it("credits courses to the school when its owner gave no name", async () => {
    renderWithIntl(<SchoolHome school={{ ...SITE_SCHOOL, ownerName: null }} courses={[PUBLISHED_COURSE]} />);
    expect(await screen.findByRole("link")).toHaveTextContent("Angkor Academy");
  });

  it("says there are no courses when the catalog is empty", async () => {
    renderWithIntl(<SchoolHome school={SITE_SCHOOL} courses={[]} />);
    expect(await screen.findByText("No courses yet.")).toBeInTheDocument();
    expect(screen.queryByRole("link")).not.toBeInTheDocument();
  });

  it("uses the Khmer catalog heading when the locale is km", async () => {
    renderWithIntl(<SchoolHome school={SITE_SCHOOL} courses={[]} />, { locale: "km" });
    expect(await screen.findByRole("heading", { level: 2, name: "វគ្គសិក្សា" })).toBeInTheDocument();
  });
});
