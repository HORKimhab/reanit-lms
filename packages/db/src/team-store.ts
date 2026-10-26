import type { DbClient } from "./client";
import type { MembershipRole } from "./generated/prisma/client";
import { forSchool, inSchoolTransaction } from "./tenant";

/** Roles staff can invite to or give; matches `InviteRole` in `@reanit/core/schools`. */
type InviteRole = "admin" | "instructor";

/** The memberships that make someone staff, as opposed to a student. */
const STAFF_ROLES: MembershipRole[] = ["owner", "admin", "instructor"];

/** An invite's columns, without its token hash. */
const INVITE_FIELDS = { id: true, email: true, role: true, expiresAt: true, createdAt: true } as const;

/**
 * Narrows a stored role to the ones invites use; the API only ever writes those.
 *
 * @param invite The stored invite.
 * @returns The invite with its role typed.
 */
function toInvite<Invite extends { role: MembershipRole }>(invite: Invite): Omit<Invite, "role"> & { role: InviteRole } {
  return { ...invite, role: invite.role as InviteRole };
}

/**
 * One school's staff and invites, through the tenant client. It satisfies `TeamStore` from `@reanit/core/schools`.
 *
 * @param db Unscoped client from `createDbClient`.
 * @param schoolId The school.
 * @returns The store operations.
 * @throws {z.ZodError} When `schoolId` is not a UUID.
 * @example
 * const team = createTeamService({ store: createTeamStore(db, schoolId), mailer, clock });
 */
export function createTeamStore(db: DbClient, schoolId: string) {
  const tenant = forSchool(db, schoolId);

  /**
   * Reads staff memberships with their users.
   *
   * @param userId Only this user's, when given.
   * @returns The members: the owner, then admins, then instructors, each oldest first.
   */
  async function findMembers(userId?: string) {
    const rows = await tenant.membership.findMany({
      where: { userId, role: { in: STAFF_ROLES } },
      orderBy: [{ role: "asc" }, { createdAt: "asc" }],
      select: { role: true, createdAt: true, user: { select: { id: true, name: true, email: true } } },
    });
    return rows.map(({ role, createdAt, user }) => ({ ...user, role: role as Exclude<MembershipRole, "student">, joinedAt: createdAt }));
  }

  return {
    /**
     * Lists the school's staff.
     *
     * @returns The owner, then admins, then instructors, each oldest first.
     */
    listMembers() {
      return findMembers();
    },

    /**
     * Lists the invites not accepted yet.
     *
     * @returns The invites, expired ones included, newest first.
     */
    async listInvites() {
      const rows = await tenant.teamInvite.findMany({ orderBy: [{ createdAt: "desc" }, { id: "desc" }], select: INVITE_FIELDS });
      return rows.map(toInvite);
    },

    /**
     * Finds one staff member.
     *
     * @param userId The user.
     * @returns The member, or null when the user is not staff of the school.
     */
    async findMember(userId: string) {
      return (await findMembers(userId))[0] ?? null;
    },

    /**
     * Checks whether the email belongs to one of the school's staff.
     *
     * @param email A normalized email.
     * @returns Whether it does.
     */
    async isStaffEmail(email: string) {
      return (await tenant.membership.count({ where: { role: { in: STAFF_ROLES }, user: { email } } })) > 0;
    },

    /**
     * Counts the seats the plan limits: team members besides the owner, and waiting invites other than one.
     *
     * @param exceptEmail The invite not to count, being sent again.
     * @returns How many seats are taken.
     */
    async countSeats(exceptEmail: string) {
      const [members, invites] = await Promise.all([
        tenant.membership.count({ where: { role: { in: ["admin", "instructor"] } } }),
        tenant.teamInvite.count({ where: { email: { not: exceptEmail } } }),
      ]);
      return members + invites;
    },

    /**
     * Saves an invite, replacing any earlier one to the same email so only the newest link works.
     *
     * @param invite The invite.
     * @param invite.email A normalized email.
     * @param invite.role Admin or instructor.
     * @param invite.tokenHash SHA-256 of the emailed token.
     * @param invite.expiresAt When the link stops working.
     * @returns The invite.
     */
    saveInvite({ email, role, tokenHash, expiresAt }: { email: string; role: InviteRole; tokenHash: string; expiresAt: Date }) {
      return inSchoolTransaction(db, schoolId, async (tx) => {
        await tx.teamInvite.deleteMany({ where: { email } });
        return toInvite(await tx.teamInvite.create({ data: { schoolId, email, role, tokenHash, expiresAt }, select: INVITE_FIELDS }));
      });
    },

    /**
     * Gives a staff member another role.
     *
     * @param userId The member.
     * @param role Admin or instructor.
     */
    async changeRole(userId: string, role: InviteRole) {
      await tenant.membership.updateMany({ where: { userId, role: { in: STAFF_ROLES } }, data: { role } });
    },

    /**
     * Removes a staff member's membership.
     *
     * @param userId The member.
     */
    async removeMember(userId: string) {
      await tenant.membership.deleteMany({ where: { userId, role: { in: STAFF_ROLES } } });
    },
  };
}

/**
 * Invites across schools, found by their token: the invitee has no school yet, so the lookup uses
 * the unscoped client, and accepting runs in the invite's school. It satisfies `InviteStore` from `@reanit/core/schools`.
 *
 * @param db Unscoped client from `createDbClient`.
 * @returns The store operations.
 * @example
 * const invites = createInviteAcceptance({ store: createInviteStore(db), clock });
 */
export function createInviteStore(db: DbClient) {
  return {
    /**
     * Finds the invite whose token has this hash, with its school.
     *
     * @param tokenHash SHA-256 of the token in the link.
     * @returns The invite, or null.
     */
    async findInvite(tokenHash: string) {
      const row = await db.teamInvite.findUnique({
        where: { tokenHash },
        select: { id: true, email: true, role: true, expiresAt: true, school: { select: { id: true, name: true, subdomain: true } } },
      });
      return row && toInvite(row);
    },

    /**
     * Deletes the invite and makes the user staff with its role, together. An owner keeps their role.
     *
     * @param invite The invite.
     * @param invite.id Its id.
     * @param invite.role The role it gives.
     * @param invite.school Its school.
     * @param invite.school.id The school's id.
     * @param userId The user accepting it.
     * @returns False when another request accepted (deleted) it first.
     */
    acceptInvite({ id, role, school }: { id: string; role: InviteRole; school: { id: string } }, userId: string) {
      return inSchoolTransaction(db, school.id, async (tx) => {
        const { count } = await tx.teamInvite.deleteMany({ where: { id } });
        if (count === 0) return false;
        const current = await tx.membership.findUnique({ where: { schoolId_userId: { schoolId: school.id, userId } }, select: { role: true } });
        if (current?.role === "owner") return true;
        await tx.membership.upsert({
          where: { schoolId_userId: { schoolId: school.id, userId } },
          create: { schoolId: school.id, userId, role },
          update: { role },
        });
        return true;
      });
    },
  };
}
