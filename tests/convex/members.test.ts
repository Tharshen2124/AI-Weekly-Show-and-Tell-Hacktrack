import { convexTest } from "convex-test";
import { describe, expect, it } from "vitest";
import { api } from "../../convex/_generated/api";
import { Id } from "../../convex/_generated/dataModel";
import schema from "../../convex/schema";
import { modules } from "./test.setup";

const ADMIN_EMAIL = "admin@example.com";
const MEMBER_EMAIL = "member@example.com";
const OUTSIDER_EMAIL = "outsider@example.com";

function memberDoc(name: string, overrides: Record<string, unknown> = {}) {
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
async function seedAccess(t: ReturnType<typeof convexTest>) {
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

describe("authorization", () => {
  it("rejects writes from a non-admin member", async () => {
    const t = convexTest(schema, modules);
    const { member } = await seedAccess(t);
    await expect(
      member.mutation(api.functions.members.create, {
        name: "Eve",
        email: "eve@example.com",
        registerDate: "2026-01-01",
      }),
    ).rejects.toThrow("Admin access required");
  });

  it("rejects anonymous callers", async () => {
    const t = convexTest(schema, modules);
    await seedAccess(t);
    await expect(t.query(api.functions.members.list, {})).rejects.toThrow("Unauthorized");
  });

  it("rejects a signed-in Google account that is not on the roster", async () => {
    const t = convexTest(schema, modules);
    await seedAccess(t);
    const stranger = t.withIdentity({ email: "nobody@example.com", emailVerified: true });
    await expect(stranger.query(api.functions.members.list, {})).rejects.toThrow("Unauthorized");
  });

  it("rejects a roster member who holds no access level", async () => {
    const t = convexTest(schema, modules);
    await seedAccess(t);
    const outsider = t.withIdentity({ email: OUTSIDER_EMAIL, emailVerified: true });
    await expect(outsider.query(api.functions.members.list, {})).rejects.toThrow("Unauthorized");
  });

  it("rejects an unverified email even when it is on the roster", async () => {
    const t = convexTest(schema, modules);
    await seedAccess(t);
    const spoofed = t.withIdentity({ email: ADMIN_EMAIL, emailVerified: false });
    await expect(spoofed.query(api.functions.members.list, {})).rejects.toThrow("Unauthorized");
  });

  it("matches the roster email case-insensitively", async () => {
    const t = convexTest(schema, modules);
    await seedAccess(t);
    const shouty = t.withIdentity({ email: "ADMIN@Example.COM", emailVerified: true });
    const result = await shouty.query(api.functions.auth.me, {});
    expect(result?.isAdmin).toBe(true);
  });

  it("allows reads for a member", async () => {
    const t = convexTest(schema, modules);
    const { member } = await seedAccess(t);
    const result = await member.query(api.functions.members.list, {});
    expect(result.data.length).toBeGreaterThan(0);
  });
});

describe("auth.me", () => {
  it("reports the access level, and null for someone without access", async () => {
    const t = convexTest(schema, modules);
    const { admin, member } = await seedAccess(t);
    expect((await admin.query(api.functions.auth.me, {}))?.accessLevel).toBe("admin");
    expect((await member.query(api.functions.auth.me, {}))?.isAdmin).toBe(false);
    const outsider = t.withIdentity({ email: OUTSIDER_EMAIL, emailVerified: true });
    expect(await outsider.query(api.functions.auth.me, {})).toBeNull();
  });
});

describe("members.create", () => {
  it("lowercases the email and defaults access to none", async () => {
    const t = convexTest(schema, modules);
    const { admin } = await seedAccess(t);
    const id = await admin.mutation(api.functions.members.create, {
      name: "Ana",
      email: "  Ana.Tan@Example.COM ",
      registerDate: "2026-01-01",
    });
    await t.run(async (ctx) => {
      const created = await ctx.db.get(id);
      expect(created!.email).toBe("ana.tan@example.com");
      expect(created!.accessLevel).toBeUndefined();
      expect(created!.isActive).toBe(false);
    });
  });

  it("refuses a duplicate email", async () => {
    const t = convexTest(schema, modules);
    const { admin } = await seedAccess(t);
    await expect(
      admin.mutation(api.functions.members.create, {
        name: "Impostor",
        email: ADMIN_EMAIL.toUpperCase(),
        registerDate: "2026-01-01",
      }),
    ).rejects.toThrow("Another member already uses that email");
  });
});

describe("members.update", () => {
  it("stops an admin from removing their own admin access", async () => {
    const t = convexTest(schema, modules);
    const { admin } = await seedAccess(t);
    const me = await admin.query(api.functions.auth.me, {});
    await expect(
      admin.mutation(api.functions.members.update, { id: me!.id, accessLevel: "member" }),
    ).rejects.toThrow("You cannot remove your own admin access");
  });

  it("grants and revokes access for someone else", async () => {
    const t = convexTest(schema, modules);
    const { admin } = await seedAccess(t);
    const outsiderId = await t.run(async (ctx) => {
      const row = await ctx.db
        .query("members")
        .withIndex("by_email", (q) => q.eq("email", OUTSIDER_EMAIL))
        .unique();
      return row!._id;
    });

    await admin.mutation(api.functions.members.update, { id: outsiderId, accessLevel: "member" });
    const outsider = t.withIdentity({ email: OUTSIDER_EMAIL, emailVerified: true });
    expect((await outsider.query(api.functions.auth.me, {}))?.accessLevel).toBe("member");

    await admin.mutation(api.functions.members.update, { id: outsiderId, accessLevel: null });
    expect(await outsider.query(api.functions.auth.me, {})).toBeNull();
  });
});

describe("updates.create member–project constraint", () => {
  it("rejects an update for a project the member doesn't belong to", async () => {
    const t = convexTest(schema, modules);
    const { admin } = await seedAccess(t);
    const { memberId, otherProjectId, meetupId } = await t.run(async (ctx) => {
      const memberId = await ctx.db.insert("members", memberDoc("Ana"));
      const otherId = await ctx.db.insert("members", memberDoc("Ben"));
      const otherProjectId = await ctx.db.insert("projects", {
        name: "Ben's Project",
        category: "solo",
        completed: false,
        updatedAt: Date.now(),
      });
      await ctx.db.insert("projectMembers", { projectId: otherProjectId, memberId: otherId });
      const meetupId = await ctx.db.insert("meetups", {
        date: "2026-05-01",
        number: 1,
        updatedAt: Date.now(),
      });
      return { memberId, otherProjectId, meetupId };
    });

    await expect(
      admin.mutation(api.functions.updates.create, {
        memberId,
        projectId: otherProjectId,
        meetupId,
        description: "Should fail",
      }),
    ).rejects.toThrow("Member does not belong to the selected project");
  });
});

describe("members.remove cascade", () => {
  it("deletes updates and memberships, and removes orphaned projects", async () => {
    const t = convexTest(schema, modules);
    const { admin } = await seedAccess(t);

    const ids = await t.run(async (ctx) => {
      const victim = await ctx.db.insert("members", memberDoc("Victim"));
      const survivor = await ctx.db.insert("members", memberDoc("Survivor"));

      // Solo project -> should be deleted with its updates.
      const soloProject = await ctx.db.insert("projects", {
        name: "Solo",
        category: "solo",
        completed: false,
        updatedAt: Date.now(),
      });
      await ctx.db.insert("projectMembers", { projectId: soloProject, memberId: victim });

      // Shared project -> should survive, minus the victim's membership.
      const sharedProject = await ctx.db.insert("projects", {
        name: "Shared",
        category: "group",
        completed: false,
        updatedAt: Date.now(),
      });
      await ctx.db.insert("projectMembers", { projectId: sharedProject, memberId: victim });
      await ctx.db.insert("projectMembers", { projectId: sharedProject, memberId: survivor });

      const meetupId = await ctx.db.insert("meetups", {
        date: "2026-05-01",
        number: 1,
        updatedAt: Date.now(),
      });

      await ctx.db.insert("updates", {
        meetupId,
        projectId: soloProject,
        memberId: victim,
        description: "solo talk",
        updatedAt: Date.now(),
      });
      await ctx.db.insert("updates", {
        meetupId,
        projectId: sharedProject,
        memberId: victim,
        description: "shared talk",
        updatedAt: Date.now(),
      });
      await ctx.db.insert("updates", {
        meetupId,
        projectId: sharedProject,
        memberId: survivor,
        description: "survivor talk",
        updatedAt: Date.now(),
      });

      return { victim, survivor, soloProject, sharedProject, meetupId };
    });

    await admin.mutation(api.functions.members.remove, { id: ids.victim });

    await t.run(async (ctx) => {
      expect(await ctx.db.get(ids.victim)).toBeNull();
      expect(await ctx.db.get(ids.soloProject)).toBeNull();
      expect(await ctx.db.get(ids.sharedProject)).not.toBeNull();
      expect(await ctx.db.get(ids.meetupId)).not.toBeNull();
      const links = await ctx.db.query("projectMembers").collect();
      expect(links).toHaveLength(1);
      expect(links[0].memberId).toBe(ids.survivor);
      const updates = await ctx.db.query("updates").collect();
      expect(updates).toHaveLength(1);
      expect(updates[0].memberId).toBe(ids.survivor);
    });
  });
});

describe("meetups.nextNumber", () => {
  it("returns max meetup number plus one", async () => {
    const t = convexTest(schema, modules);
    const { member } = await seedAccess(t);
    await t.run(async (ctx) => {
      await ctx.db.insert("meetups", { date: "2026-01-01", number: 47, updatedAt: Date.now() });
      await ctx.db.insert("meetups", { date: "2026-01-02", number: 12, updatedAt: Date.now() });
    });
    expect(await member.query(api.functions.meetups.nextNumber, {})).toBe(48);
  });
});

describe("projects.remove cascade", () => {
  it("deletes the project's updates and memberships", async () => {
    const t = convexTest(schema, modules);
    const { admin } = await seedAccess(t);
    const { projectId } = await t.run(async (ctx) => {
      const memberId = await ctx.db.insert("members", memberDoc("Ana"));
      const projectId = await ctx.db.insert("projects", {
        name: "Doomed",
        category: "solo",
        completed: false,
        updatedAt: Date.now(),
      });
      await ctx.db.insert("projectMembers", { projectId, memberId });
      const meetupId = await ctx.db.insert("meetups", {
        date: "2026-05-01",
        number: 1,
        updatedAt: Date.now(),
      });
      await ctx.db.insert("updates", {
        meetupId,
        projectId,
        memberId,
        description: "doomed talk",
        updatedAt: Date.now(),
      });
      return { projectId };
    });

    await admin.mutation(api.functions.projects.remove, { id: projectId });

    await t.run(async (ctx) => {
      expect(await ctx.db.get(projectId as Id<"projects">)).toBeNull();
      expect(await ctx.db.query("updates").collect()).toHaveLength(0);
      expect(await ctx.db.query("projectMembers").collect()).toHaveLength(0);
    });
  });
});
