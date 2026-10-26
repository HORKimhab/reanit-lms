/** A signed-in person, as the app sees them. */
export interface AuthUser {
  id: string;
  email: string;
  name: string | null;
}

/** Persistence that auth needs. `@reanit/db` implements it with `createAuthStore`. */
export interface AuthStore {
  /** Looks up a user by normalized email, with their hash (null for magic-link-only accounts). */
  findUserByEmail(email: string): Promise<(AuthUser & { passwordHash: string | null }) | null>;
  /** Inserts a user. Email is already normalized and checked for duplicates. */
  createUser(user: { email: string; name: string | null; passwordHash: string | null }): Promise<AuthUser>;
  createSession(session: { tokenHash: string; userId: string; expiresAt: Date }): Promise<void>;
  findSession(tokenHash: string): Promise<{ user: AuthUser; expiresAt: Date } | null>;
  deleteSession(tokenHash: string): Promise<void>;
  createMagicLink(link: { tokenHash: string; email: string; expiresAt: Date }): Promise<void>;
  /** Deletes the link and returns it, or null if missing. Only one caller can consume a link. */
  consumeMagicLink(tokenHash: string): Promise<{ email: string; expiresAt: Date } | null>;
}

/** An email ready to send. */
export interface MailMessage {
  to: string;
  subject: string;
  /** Plain-text body, for clients that show no HTML. */
  text: string;
  /** HTML body; plain text only when left out. */
  html?: string;
  /** Where the reader stops this kind of email; sent as the `List-Unsubscribe` header, so mail apps offer it too. */
  unsubscribeUrl?: string;
}

/** Sends email. The app provides SMTP (Mailpit locally); tests use a fake. */
export interface Mailer {
  send(message: MailMessage): Promise<void>;
}

/** Current time, injected so expiry is testable. */
export interface Clock {
  now(): Date;
}

/** Everything stored about a person, across every school, as their data export lists it. */
export interface UserDataExport {
  account: AuthUser & { createdAt: Date };
  memberships: { school: string; role: string; joinedAt: Date }[];
  enrollments: {
    school: string;
    course: string;
    source: string;
    enrolledAt: Date;
    completedAt: Date | null;
    lessons: { lesson: string; videoPositionSeconds: number; completedAt: Date | null }[];
  }[];
  /** Money in integer minor units with its ISO currency. */
  orders: {
    school: string;
    status: string;
    paymentMethod: string;
    total: { amount: number; currency: string };
    items: { course: string; amount: number; currency: string }[];
    createdAt: Date;
    paidAt: Date | null;
  }[];
  quizAttempts: { school: string; lesson: string; scorePercent: number; isPassed: boolean; answers: unknown; createdAt: Date }[];
  comments: { school: string; lesson: string; body: string; createdAt: Date }[];
  certificates: { id: string; school: string; studentName: string; courseTitle: string; issuedAt: Date }[];
}

/** A person's own data across schools, for export and erasure. `@reanit/db` implements it with `createAccountStore`. */
export interface AccountStore {
  /** Everything stored about the user, or null when they no longer exist. */
  exportUserData(userId: string): Promise<UserDataExport | null>;
  /** Whether the user is an owner, admin or instructor of any school. */
  isSchoolStaff(userId: string): Promise<boolean>;
  /**
   * Erases the user in one transaction: their learning, comments' authorship, settings and sessions go,
   * and the account keeps only its id, so the school's orders stay whole for its accounts.
   */
  eraseUser(userId: string): Promise<void>;
}
