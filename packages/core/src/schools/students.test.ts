import { describe, expect, it } from "vitest";

import { FakeStudentStore } from "../test/school-fakes";
import type { StudentSummary } from "./ports";
import { createStudentService, STUDENTS_PAGE_SIZE } from "./students";

const SOKHA: StudentSummary = {
  id: "user-1",
  name: "Sokha Chan",
  email: "sokha@example.com",
  joinedAt: new Date("2026-03-14T00:00:00Z"),
  courses: 2,
  completedCourses: 1,
};

describe("searchStudents", () => {
  it("returns the store's page with the total, page and page size", async () => {
    const store = new FakeStudentStore();
    store.students = [SOKHA];
    store.total = 1;

    const page = await createStudentService({ store }).searchStudents({ page: 1 });

    expect(page).toEqual({ students: [SOKHA], total: 1, page: 1, pageSize: STUDENTS_PAGE_SIZE });
    expect(store.lastQuery).toEqual({ search: null, limit: STUDENTS_PAGE_SIZE, offset: 0 });
  });

  it("skips the earlier pages' students", async () => {
    const store = new FakeStudentStore();

    await createStudentService({ store }).searchStudents({ page: 3 });

    expect(store.lastQuery?.offset).toBe(2 * STUDENTS_PAGE_SIZE);
  });

  it("passes the search text, and treats a blank one as no search", async () => {
    const store = new FakeStudentStore();
    const students = createStudentService({ store });

    await students.searchStudents({ q: "sokha", page: 1 });
    expect(store.lastQuery?.search).toBe("sokha");

    await students.searchStudents({ q: "", page: 1 });
    expect(store.lastQuery?.search).toBeNull();
  });
});
