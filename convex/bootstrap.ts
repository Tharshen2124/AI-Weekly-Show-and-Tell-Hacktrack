import { v } from "convex/values";
import { internalMutation } from "./_generated/server";
import { accessLevelValidator } from "./schema";
import { normalizeEmail } from "./lib/auth";

/**
 * Grants app access by email, creating a member row if none exists.
 *
 * This is the only way to create the first admin: every other path requires an
 * admin already. Run it with `npx convex run bootstrap:grantAccess`. It is
 * idempotent, so it is safe to re-run after wiping the database.
 */
export const grantAccess = internalMutation({
  args: {
    email: v.string(),
    accessLevel: accessLevelValidator,
    name: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const email = normalizeEmail(args.email);
    if (email === "") throw new Error("Email is required");

    const existing = await ctx.db
      .query("members")
      .withIndex("by_email", (q) => q.eq("email", email))
      .first();

    if (existing) {
      await ctx.db.patch(existing._id, {
        accessLevel: args.accessLevel,
        ...(args.name ? { name: args.name } : {}),
        updatedAt: Date.now(),
      });
      return `Updated ${email} -> ${args.accessLevel}`;
    }

    await ctx.db.insert("members", {
      name: args.name ?? email,
      email,
      isActive: true,
      registerDate: new Date().toISOString().slice(0, 10),
      progressTalkNum: 0,
      accessLevel: args.accessLevel,
      updatedAt: Date.now(),
    });
    return `Created ${email} as ${args.accessLevel}`;
  },
});
