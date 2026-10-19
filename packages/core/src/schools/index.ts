export { NotSchoolStaffError, SchoolNotFoundError, SubdomainTakenError } from "./errors";
export type { MembershipRole, School, SchoolStore } from "./ports";
export { createSchoolSchema, subdomainSchema, suggestSubdomain, type CreateSchoolInput } from "./rules";
export { createSchoolService, type SchoolService } from "./service";
