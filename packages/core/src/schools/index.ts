export {
  createDomainService,
  customDomainSchema,
  DOMAIN_HOSTNAME_MAX_LENGTH,
  domainHostnameSchema,
  type CustomDomain,
  type CustomDomainInput,
  type CustomDomainStatus,
  type DnsRecord,
  type DomainEdge,
  type DomainService,
} from "./domains";
export {
  CustomDomainsUnavailableError,
  DomainNotAllowedError,
  DomainNotFoundError,
  DomainNotVerifiedError,
  DomainTakenError,
  NotSchoolStaffError,
  SchoolHasDomainError,
  SchoolNotFoundError,
  SubdomainTakenError,
} from "./errors";
export type {
  DnsLookup,
  DomainCertificates,
  DomainChanges,
  DomainRecord,
  DomainStore,
  DomainTlsStatus,
  MembershipRole,
  School,
  SchoolChanges,
  SchoolRecord,
  SchoolStore,
  StudentStore,
  StudentSummary,
} from "./ports";
export {
  createSchoolSchema,
  DEFAULT_BRAND_COLOR,
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
