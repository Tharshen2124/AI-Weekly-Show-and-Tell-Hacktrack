import { QueryCtx, MutationCtx } from "../_generated/server";

export async function requireSession(
  ctx: QueryCtx | MutationCtx,
  token: string,
): Promise<{ isAdmin: boolean }> {
  const session = await ctx.db
    .query("sessions")
    .withIndex("by_token", (q) => q.eq("token", token))
    .unique();
  if (!session || session.expiresAt < Date.now()) {
    throw new Error("Unauthorized");
  }
  return { isAdmin: session.isAdmin };
}

export async function requireAdmin(
  ctx: QueryCtx | MutationCtx,
  token: string,
): Promise<{ isAdmin: true }> {
  const { isAdmin } = await requireSession(ctx, token);
  if (!isAdmin) {
    throw new Error("Admin access required");
  }
  return { isAdmin: true };
}
