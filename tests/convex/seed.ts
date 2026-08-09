import { convexTest } from "convex-test";

export const ADMIN_EMAIL = "admin@example.com";
export const MEMBER_EMAIL = "member@example.com";
export const OUTSIDER_EMAIL = "outsider@example.com";

export function memberDoc(name: string, overrides: Record<string, unknown> = {}) {
  return {
    name,
    email: `${name.toLowerCase()}@example.com`,
    isActive: true,
    registerDate: "2026-01-01",
    progressTalkNum: 0,
    updatedAt: Date.now(),
    ...overrides,
  };
}

/** Seeds the two people who can sign in, and returns clients acting as each. */
export async function seedAccess(t: ReturnType<typeof convexTest>) {
  await t.run(async (ctx) => {
    await ctx.db.insert("members", {
      ...memberDoc("Admin"),
      email: ADMIN_EMAIL,
      accessLevel: "admin" as const,
    });
    await ctx.db.insert("members", {
      ...memberDoc("Member"),
      email: MEMBER_EMAIL,
      accessLevel: "member" as const,
    });
    // On the roster but with no access level granted.
    await ctx.db.insert("members", { ...memberDoc("Outsider"), email: OUTSIDER_EMAIL });
  });
  return {
    admin: t.withIdentity({ email: ADMIN_EMAIL, emailVerified: true }),
    member: t.withIdentity({ email: MEMBER_EMAIL, emailVerified: true }),
  };
}
