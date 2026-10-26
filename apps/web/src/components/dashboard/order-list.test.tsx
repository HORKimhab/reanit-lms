import { screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { ORDER } from "@/test/orders";
import { renderWithIntl } from "@/test/render";

import { OrderList } from "./order-list";

const COURSES = [{ id: ORDER.items[0]!.courseId, title: "Brand Design Basics" }]; // ORDER sells one course
const PAGE = { orders: [ORDER], total: 120, page: 2, pageSize: 50 };

describe("OrderList", () => {
  it("lists the orders, each linking to its detail", async () => {
    renderWithIntl(<OrderList result={PAGE} filters={{}} courses={COURSES} />);

    const table = await screen.findByRole("table", { name: "Orders" });
    const [, row] = within(table).getAllByRole("row");
    expect(row).toHaveTextContent("Sokha Chan");
    expect(row).toHaveTextContent("$39.20");
    expect(within(row!).getByRole("link", { name: "6F1C1F3E" })).toHaveAttribute("href", `/dashboard/orders/${ORDER.id}`); // the table has a body row
  });

  it("keeps the filters in the form and in the page links", async () => {
    renderWithIntl(<OrderList result={PAGE} filters={{ status: "paid", currency: "USD", from: "2026-10-01" }} courses={COURSES} />);

    expect(await screen.findByRole("combobox", { name: "Status" })).toHaveValue("paid");
    expect(screen.getByRole("combobox", { name: "Currency" })).toHaveValue("USD");
    expect(screen.getByRole("combobox", { name: "Course" })).toHaveValue("");
    expect(screen.getByLabelText("From")).toHaveValue("2026-10-01");
    expect(screen.getByRole("link", { name: "Next page" })).toHaveAttribute("href", "/dashboard/orders?status=paid&currency=USD&from=2026-10-01&page=3");
  });

  it("says no order matches the filters", async () => {
    renderWithIntl(<OrderList result={{ ...PAGE, orders: [], total: 0 }} filters={{ status: "failed" }} courses={COURSES} />);

    expect(await screen.findByText("No orders found")).toBeInTheDocument();
  });

  it("says there are no orders yet without filters", async () => {
    renderWithIntl(<OrderList result={{ ...PAGE, orders: [], total: 0 }} filters={{}} courses={COURSES} />);

    expect(await screen.findByText("No orders yet")).toBeInTheDocument();
  });
});
