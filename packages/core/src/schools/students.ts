import { pageWindow } from "../shared/paging";
import type { StudentStore, StudentSummary } from "./ports";
import type { StudentSearchInput } from "./rules";

/** Students shown per page of the dashboard's students list. */
export const STUDENTS_PAGE_SIZE = 50;

/** One page of a school's students. */
export interface StudentPage {
  students: StudentSummary[];
  /** Students matching the search across all pages. */
  total: number;
  page: number;
  pageSize: number;
}

/**
 * Builds one school's students list use cases.
 *
 * @param dependencies The school's students.
 * @param dependencies.store Persistence for the school's students.
 * @returns The students operations.
 * @example
 * const students = createStudentService({ store: createStudentStore(db, schoolId) });
 */
export function createStudentService({ store }: { store: StudentStore }) {
  return {
    /**
     * Lists one page of the school's students, newest first, optionally searched by name or email.
     *
     * @param query The search and page.
     * @param query.q Text to find in a student's name or email; blank lists everyone.
     * @param query.page 1-based page; past the last page it is empty.
     * @returns The page's students and how many match in total.
     */
    async searchStudents({ q, page }: StudentSearchInput): Promise<StudentPage> {
      const { students, total } = await store.searchStudents({ search: q || null, ...pageWindow(page, STUDENTS_PAGE_SIZE) });
      return { students, total, page, pageSize: STUDENTS_PAGE_SIZE };
    },
  };
}

/** One school's students list use cases. */
export type StudentService = ReturnType<typeof createStudentService>;
