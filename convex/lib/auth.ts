import { QueryCtx, MutationCtx } from "../_generated/server";
import { Doc } from "../_generated/dataModel";

type Ctx = QueryCtx | MutationCtx;

/** Emails are the identity key, so they are compared in one canonical form. */
export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

/**
 * The signed-in person's member row, or null when they are not signed in, their
 * email is unverified, or they hold no access level.
 *
 * Google authenticates; this table authorizes. Both checks must stay on the
 * server — the client can claim anything.
 */
export async function currentMember(ctx: Ctx): Promise<Doc<"members"> | null> {
  const identity = await ctx.auth.getUserIdentity();
  // Both claims come from Clerk's session token; `email` and `email_verified`
  // must be mapped in Clerk's "Customize session token" claims, since the
  // Convex integration only pre-maps `aud`. An unverified email could be
  // attacker-chosen, so it can never grant access.
  if (!identity?.email || identity.emailVerified !== true) return null;

  // .unique() throws if two rows share an email. That fails closed, which is
  // what we want: duplicates must never silently pick the higher access level.
  const member = await ctx.db
    .query("members")
    .withIndex("by_email", (q) => q.eq("email", normalizeEmail(identity.email!)))
    .unique();

  return member?.accessLevel ? member : null;
}

export async function requireMember(ctx: Ctx): Promise<Doc<"members">> {
  const member = await currentMember(ctx);
  if (!member) throw new Error("Unauthorized");
  return member;
}

export async function requireAdmin(ctx: Ctx): Promise<Doc<"members">> {
  const member = await requireMember(ctx);
  if (member.accessLevel !== "admin") throw new Error("Admin access required");
  return member;
}
