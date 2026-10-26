import { z } from "zod";

import { emailSchema, generateToken, hashToken, type AuthUser, type Clock, type MailMessage, type Mailer } from "../auth";
import { EMAIL_LOCALES } from "../notifications";
import {
  AlreadyTeamMemberError,
  InviteEmailMismatchError,
  InviteExpiredError,
  InviteNotFoundError,
  OwnerLockedError,
  TeamMemberNotFoundError,
} from "./errors";
import type { PlanGuard } from "./plans";
import type { InviteRecord, InviteStore, TeamInvite, TeamMember, TeamStore } from "./ports";

/** Roles staff can invite to or give: everything but owner, which stays with the school's creator. */
export const INVITE_ROLES = ["admin", "instructor"] as const;

/** A role staff can invite to or give. */
export type InviteRole = (typeof INVITE_ROLES)[number];

/** Days an invite link works. */
export const INVITE_DAYS = 7;

const DAY_MS = 24 * 60 * 60 * 1000;

/** `POST /team/invites` body: who to invite, as what, and the language of their email. */
export const inviteSchema = z.object({
  email: emailSchema,
  role: z.enum(INVITE_ROLES),
  locale: z.enum(EMAIL_LOCALES).default("en"),
});

/** `PATCH /team/members/:id` body: the member's new role. */
export const changeRoleSchema = z.object({ role: z.enum(INVITE_ROLES) });

/** Parsed invite input. */
export type InviteInput = z.infer<typeof inviteSchema>;

/** A school's staff and the invites waiting for an answer. */
export interface Team {
  members: TeamMember[];
  invites: TeamInvite[];
}

/** An invite as its link shows it, before it is accepted. */
export type InvitePreview = Omit<InviteRecord, "id" | "school"> & { school: Omit<InviteRecord["school"], "id"> };

/**
 * Writes the invite email for a token, without the recipient (it is the invited email).
 *
 * @param token The secret for the invite link.
 * @returns Subject and bodies.
 */
export type ComposeInvite = (token: string) => Promise<Omit<MailMessage, "to">>;

/**
 * Builds one school's team use cases: list the staff and invites, invite by email, change a
 * member's role and remove a member. The owner can't be removed or given another role.
 *
 * @param dependencies The school's team, the mailer, the clock and the school's plan.
 * @param dependencies.store The school's staff and invites.
 * @param dependencies.mailer Sends invite emails.
 * @param dependencies.clock Sets when invites expire.
 * @param dependencies.plan The school's plan, which limits how many team members it has.
 * @returns The team operations.
 * @example
 * const team = createTeamService({ store: createTeamStore(db, schoolId), mailer, clock });
 * await team.inviteMember({ email: "dara@example.com", role: "instructor", locale: "en" }, compose);
 */
export function createTeamService({ store, mailer, clock, plan }: { store: TeamStore; mailer: Mailer; clock: Clock; plan: Pick<PlanGuard, "assertWithin"> }) {
  /**
   * Finds a member whose role can change: staff, but not the owner.
   *
   * @param userId The member.
   * @returns The member.
   * @throws {TeamMemberNotFoundError} When the user is not staff of the school.
   * @throws {OwnerLockedError} When the user is the owner.
   */
  async function findChangeableMember(userId: string): Promise<TeamMember> {
    const member = await store.findMember(userId);
    if (!member) throw new TeamMemberNotFoundError();
    if (member.role === "owner") throw new OwnerLockedError();
    return member;
  }

  return {
    /**
     * Lists the school's staff and the invites not accepted yet.
     *
     * @returns The team.
     */
    async listTeam(): Promise<Team> {
      const [members, invites] = await Promise.all([store.listMembers(), store.listInvites()]);
      return { members, invites };
    },

    /**
     * Invites someone to the school's staff and emails them the link. Inviting the same email
     * again replaces the earlier invite, so only the newest link works.
     *
     * @param input Who to invite and as what.
     * @param input.email Their email.
     * @param input.role Admin or instructor.
     * @param compose Writes the email for the link's token.
     * @returns The invite.
     * @throws {AlreadyTeamMemberError} When the email already belongs to the school's staff.
     * @throws {PlanLimitError} When another team member would pass the plan's limit.
     */
    async inviteMember({ email, role }: InviteInput, compose: ComposeInvite): Promise<TeamInvite> {
      if (await store.isStaffEmail(email)) throw new AlreadyTeamMemberError();
      await plan.assertWithin("teamMembers", await store.countSeats(email));
      const token = generateToken();
      const expiresAt = new Date(clock.now().getTime() + INVITE_DAYS * DAY_MS);
      const invite = await store.saveInvite({ email, role, tokenHash: hashToken(token), expiresAt });
      await mailer.send({ to: email, ...(await compose(token)) });
      return invite;
    },

    /**
     * Gives a staff member another role.
     *
     * @param userId The member.
     * @param role Admin or instructor.
     * @returns The member with their new role.
     * @throws {TeamMemberNotFoundError} When the user is not staff of the school.
     * @throws {OwnerLockedError} When the user is the owner.
     */
    async changeRole(userId: string, role: InviteRole): Promise<TeamMember> {
      const member = await findChangeableMember(userId);
      await store.changeRole(userId, role);
      return { ...member, role };
    },

    /**
     * Removes a staff member from the school; they lose the dashboard but keep any courses they bought.
     *
     * @param userId The member.
     * @throws {TeamMemberNotFoundError} When the user is not staff of the school.
     * @throws {OwnerLockedError} When the user is the owner.
     */
    async removeMember(userId: string): Promise<void> {
      await findChangeableMember(userId);
      await store.removeMember(userId);
    },
  };
}

/**
 * Builds the invite link use cases, which work across schools: the invitee has no school yet.
 *
 * @param dependencies Invites and the clock.
 * @param dependencies.store Invites found by token.
 * @param dependencies.clock Decides whether an invite expired.
 * @returns The invite operations.
 * @example
 * const { school } = await createInviteAcceptance({ store: createInviteStore(db), clock }).acceptInvite(token, user);
 */
export function createInviteAcceptance({ store, clock }: { store: InviteStore; clock: Clock }) {
  /**
   * Finds the invite a link's token opens.
   *
   * @param token The token from the link.
   * @returns The invite.
   * @throws {InviteNotFoundError} When no invite has the token.
   * @throws {InviteExpiredError} When the invite expired.
   */
  async function findOpenInvite(token: string): Promise<InviteRecord> {
    const invite = await store.findInvite(hashToken(token));
    if (!invite) throw new InviteNotFoundError();
    if (invite.expiresAt <= clock.now()) throw new InviteExpiredError();
    return invite;
  }

  return {
    /**
     * Shows what an invite link is for, before the invitee accepts it.
     *
     * @param token The token from the link.
     * @returns The school, the role and the invited email.
     * @throws {InviteNotFoundError} When no invite has the token.
     * @throws {InviteExpiredError} When the invite expired.
     */
    async getInvite(token: string): Promise<InvitePreview> {
      const { email, role, expiresAt, school } = await findOpenInvite(token);
      return { email, role, expiresAt, school: { name: school.name, subdomain: school.subdomain } };
    },

    /**
     * Accepts an invite: the signed-in user joins the school's staff with the invite's role.
     *
     * @param token The token from the link.
     * @param user The signed-in user; their email must be the invited one.
     * @returns The school they joined and their role in it.
     * @throws {InviteNotFoundError} When no invite has the token, or another request accepted it first.
     * @throws {InviteExpiredError} When the invite expired.
     * @throws {InviteEmailMismatchError} When the user's email is not the invited one.
     */
    async acceptInvite(token: string, user: AuthUser): Promise<{ school: InviteRecord["school"]; role: InviteRole }> {
      const invite = await findOpenInvite(token);
      if (invite.email !== user.email) throw new InviteEmailMismatchError();
      if (!(await store.acceptInvite(invite, user.id))) throw new InviteNotFoundError();
      return { school: invite.school, role: invite.role };
    },
  };
}

/** One school's team use cases. */
export type TeamService = ReturnType<typeof createTeamService>;

/** The invite link use cases. */
export type InviteAcceptance = ReturnType<typeof createInviteAcceptance>;
