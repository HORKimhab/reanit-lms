export { NotSchoolStaffError, SchoolNotFoundError, SubdomainTakenError } from "./errors";
export type { MembershipRole, School, SchoolChanges, SchoolRecord, SchoolStore, StudentStore, StudentSummary } from "./ports";
export {
  createSchoolSchema,
  LOGO_RULES,
  SCHOOL_NAME_MAX_LENGTH,
  schoolSettingsSchema,
  studentSearchSchema,
  subdomainSchema,
  suggestSubdomain,
  type CreateSchoolInput,
  type SchoolSettingsInput,
  type StudentSearchInput,
} from "./rules";
export { createSchoolService, LOGO_URL_TTL_SECONDS, type SchoolService } from "./service";
export { createStudentService, STUDENTS_PAGE_SIZE, type StudentPage, type StudentService } from "./students";
