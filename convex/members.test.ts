import { convexTest } from "convex-test";
import { describe, expect, it } from "vitest";
import { api } from "./_generated/api";
import { Id } from "./_generated/dataModel";
import schema from "./schema";
import { modules } from "./test.setup";

const FAR_FUTURE = Date.now() + 24 * 60 * 60 * 1000;

async function seedSessions(t: ReturnType<typeof convexTest>) {
  await t.run(async (ctx) => {
    await ctx.db.insert("sessions", { token: "admin-token", isAdmin: true, expiresAt: FAR_FUTURE });
    await ctx.db.insert("sessions", { token: "member-token", isAdmin: false, expiresAt: FAR_FUTURE });
    await ctx.db.insert("sessions", { token: "expired-token", isAdmin: true, expiresAt: 1 });
  });
}

function memberDoc(name: string) {
  return {
    name,
    email: `${name.toLowerCase()}@example.com`,
    isActive: true,
    registerDate: "2026-01-01",
    progressTalkNum: 0,
    updatedAt: Date.now(),
  };
}

describe("authorization", () => {
  it("rejects writes with a member token", async () => {
    const t = convexTest(schema, modules);
    await seedSessions(t);
    await expect(
      t.mutation(api.members.create, {
        token: "member-token",
        name: "Eve",
        email: "eve@example.com",
        registerDate: "2026-01-01",
      }),
    ).rejects.toThrow("Admin access required");
  });

  it("rejects expired and unknown tokens", async () => {
    const t = convexTest(schema, modules);
    await seedSessions(t);
    await expect(
      t.query(api.members.list, { token: "expired-token" }),
    ).rejects.toThrow("Unauthorized");
    await expect(t.query(api.members.list, { token: "nope" })).rejects.toThrow("Unauthorized");
  });

  it("allows reads with a member token", async () => {
    const t = convexTest(schema, modules);
    await seedSessions(t);
    const result = await t.query(api.members.list, { token: "member-token" });
    expect(result.data).toEqual([]);
  });
});

describe("members.create defaults", () => {
  it("defaults isActive to false and progressTalkNum to 0", async () => {
    const t = convexTest(schema, modules);
    await seedSessions(t);
    const id = await t.mutation(api.members.create, {
      token: "admin-token",
      name: "Ana",
      email: "ana@example.com",
      registerDate: "2026-01-01",
    });
    await t.run(async (ctx) => {
      const member = await ctx.db.get(id);
      expect(member!.isActive).toBe(false);
      expect(member!.progressTalkNum).toBe(0);
    });
  });
});

describe("members.list isActive filter", () => {
  it("filters on isActive and returns everyone when unset", async () => {
    const t = convexTest(schema, modules);
    await seedSessions(t);
    await t.run(async (ctx) => {
      await ctx.db.insert("members", memberDoc("Ana"));
      await ctx.db.insert("members", { ...memberDoc("Ben"), isActive: false });
    });
    const active = await t.query(api.members.list, { token: "member-token", isActive: true });
    expect(active.data.map((m) => m.name)).toEqual(["Ana"]);
    const inactive = await t.query(api.members.list, { token: "member-token", isActive: false });
    expect(inactive.data.map((m) => m.name)).toEqual(["Ben"]);
    const all = await t.query(api.members.list, { token: "member-token" });
    expect(all.data).toHaveLength(2);
  });
});

describe("updates.create member–project constraint", () => {
  it("rejects an update for a project the member doesn't belong to", async () => {
    const t = convexTest(schema, modules);
    await seedSessions(t);
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
      t.mutation(api.updates.create, {
        token: "admin-token",
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
    await seedSessions(t);

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

    await t.mutation(api.members.remove, { token: "admin-token", id: ids.victim });

    await t.run(async (ctx) => {
      // Member gone.
      expect(await ctx.db.get(ids.victim)).toBeNull();
      // Solo project deleted; shared project and meetup survive.
      expect(await ctx.db.get(ids.soloProject)).toBeNull();
      expect(await ctx.db.get(ids.sharedProject)).not.toBeNull();
      expect(await ctx.db.get(ids.meetupId)).not.toBeNull();
      // No orphaned rows anywhere.
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
    await seedSessions(t);
    await t.run(async (ctx) => {
      await ctx.db.insert("meetups", { date: "2026-01-01", number: 47, updatedAt: Date.now() });
      await ctx.db.insert("meetups", { date: "2026-01-02", number: 12, updatedAt: Date.now() });
    });
    const next = await t.query(api.meetups.nextNumber, { token: "member-token" });
    expect(next).toBe(48);
  });
});

describe("projects.remove cascade", () => {
  it("deletes the project's updates and memberships", async () => {
    const t = convexTest(schema, modules);
    await seedSessions(t);
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

    await t.mutation(api.projects.remove, { token: "admin-token", id: projectId });

    await t.run(async (ctx) => {
      expect(await ctx.db.get(projectId as Id<"projects">)).toBeNull();
      expect(await ctx.db.query("updates").collect()).toHaveLength(0);
      expect(await ctx.db.query("projectMembers").collect()).toHaveLength(0);
    });
  });
});
