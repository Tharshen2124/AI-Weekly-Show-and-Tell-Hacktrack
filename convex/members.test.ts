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
    status: "active" as const,
    registerDate: "2026-01-01",
    active: true,
  };
}

describe("authorization", () => {
  it("rejects writes with a member token", async () => {
    const t = convexTest(schema, modules);
    await seedSessions(t);
    const { active, ...createFields } = memberDoc("Eve");
    void active; // members.create derives `active` itself
    await expect(
      t.mutation(api.members.create, { token: "member-token", ...createFields }),
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

describe("updates.create member–project constraint", () => {
  it("rejects an update for a project the member doesn't belong to", async () => {
    const t = convexTest(schema, modules);
    await seedSessions(t);
    const { memberId, otherProjectId, meetupId } = await t.run(async (ctx) => {
      const memberId = await ctx.db.insert("members", memberDoc("Ana"));
      const otherId = await ctx.db.insert("members", memberDoc("Ben"));
      const otherProjectId = await ctx.db.insert("projects", {
        name: "Ben's Project",
        category: "project",
        completed: false,
      });
      await ctx.db.insert("projectMembers", { projectId: otherProjectId, memberId: otherId });
      const meetupId = await ctx.db.insert("meetups", {
        date: "2026-05-01",
        category: "regular_meetup",
        number: 1,
      });
      return { memberId, otherProjectId, meetupId };
    });

    await expect(
      t.mutation(api.updates.create, {
        token: "admin-token",
        memberId,
        projectId: otherProjectId,
        meetupId,
        category: "progress_talk",
        description: "Should fail",
      }),
    ).rejects.toThrow("Member does not belong to the selected project");
  });
});

describe("members.remove cascade", () => {
  it("deletes updates, memberships, orphaned projects, and nulls hostId", async () => {
    const t = convexTest(schema, modules);
    await seedSessions(t);

    const ids = await t.run(async (ctx) => {
      const victim = await ctx.db.insert("members", memberDoc("Victim"));
      const survivor = await ctx.db.insert("members", memberDoc("Survivor"));

      // Solo project -> should be deleted with its updates.
      const soloProject = await ctx.db.insert("projects", {
        name: "Solo",
        category: "project",
        completed: false,
      });
      await ctx.db.insert("projectMembers", { projectId: soloProject, memberId: victim });

      // Shared project -> should survive, minus the victim's membership.
      const sharedProject = await ctx.db.insert("projects", {
        name: "Shared",
        category: "group_project",
        completed: false,
      });
      await ctx.db.insert("projectMembers", { projectId: sharedProject, memberId: victim });
      await ctx.db.insert("projectMembers", { projectId: sharedProject, memberId: survivor });

      const hostedMeetup = await ctx.db.insert("meetups", {
        date: "2026-05-01",
        category: "regular_meetup",
        number: 1,
        hostId: victim,
      });

      await ctx.db.insert("updates", {
        meetupId: hostedMeetup,
        projectId: soloProject,
        memberId: victim,
        category: "progress_talk",
        description: "solo talk",
      });
      await ctx.db.insert("updates", {
        meetupId: hostedMeetup,
        projectId: sharedProject,
        memberId: victim,
        category: "idea_talk",
        description: "shared talk",
      });
      await ctx.db.insert("updates", {
        meetupId: hostedMeetup,
        projectId: sharedProject,
        memberId: survivor,
        category: "progress_talk",
        description: "survivor talk",
      });

      return { victim, survivor, soloProject, sharedProject, hostedMeetup };
    });

    await t.mutation(api.members.remove, { token: "admin-token", id: ids.victim });

    await t.run(async (ctx) => {
      // Member gone.
      expect(await ctx.db.get(ids.victim)).toBeNull();
      // Solo project deleted; shared project survives.
      expect(await ctx.db.get(ids.soloProject)).toBeNull();
      expect(await ctx.db.get(ids.sharedProject)).not.toBeNull();
      // No orphaned rows anywhere.
      const links = await ctx.db.query("projectMembers").collect();
      expect(links).toHaveLength(1);
      expect(links[0].memberId).toBe(ids.survivor);
      const updates = await ctx.db.query("updates").collect();
      expect(updates).toHaveLength(1);
      expect(updates[0].memberId).toBe(ids.survivor);
      // Hosted meetup survives with hostId cleared.
      const meetup = await ctx.db.get(ids.hostedMeetup);
      expect(meetup).not.toBeNull();
      expect(meetup!.hostId).toBeUndefined();
    });
  });
});

describe("meetups.nextNumbers", () => {
  it("keeps independent counters per category", async () => {
    const t = convexTest(schema, modules);
    await seedSessions(t);
    await t.run(async (ctx) => {
      await ctx.db.insert("meetups", { date: "2026-01-01", category: "regular_meetup", number: 47 });
      await ctx.db.insert("meetups", { date: "2026-01-02", category: "hackathon", number: 12 });
      await ctx.db.insert("meetups", { date: "2026-01-03", category: "off_record_meetup", number: 99 });
    });
    const next = await t.query(api.meetups.nextNumbers, { token: "member-token" });
    expect(next).toEqual({ regularMeetup: 48, hackathon: 13 });
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
        category: "project",
        completed: false,
      });
      await ctx.db.insert("projectMembers", { projectId, memberId });
      const meetupId = await ctx.db.insert("meetups", {
        date: "2026-05-01",
        category: "regular_meetup",
        number: 1,
      });
      await ctx.db.insert("updates", {
        meetupId,
        projectId,
        memberId,
        category: "progress_talk",
        description: "doomed talk",
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
