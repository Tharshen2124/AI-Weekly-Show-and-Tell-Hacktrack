import { v } from "convex/values";
import { mutation, query, QueryCtx } from "./_generated/server";
import { Doc, Id } from "./_generated/dataModel";
import { requireAdmin, requireSession } from "./lib/session";
import { computeMemberMetrics, MemberMetrics, UpdateForMetrics } from "./lib/metrics";

const PAGE_SIZE = 24;

export type MemberWithMetrics = Doc<"members"> & MemberMetrics & { projectCount: number };

function todayISO(): string {
  return new Date().toISOString().slice(0, 10);
}

/**
 * Loads everything needed to compute metrics for any set of members in one pass:
 * meetup lookup, per-member updates, per-member project counts.
 */
async function loadMetricsContext(ctx: QueryCtx) {
  const [meetups, updates, projectMembers] = await Promise.all([
    ctx.db.query("meetups").collect(),
    ctx.db.query("updates").collect(),
    ctx.db.query("projectMembers").collect(),
  ]);

  const meetupById = new Map(meetups.map((m) => [m._id, m]));
  const meetupDates = meetups.map((m) => m.date);

  const updatesByMember = new Map<Id<"members">, UpdateForMetrics[]>();
  for (const u of updates) {
    const meetup = meetupById.get(u.meetupId);
    if (!meetup) continue;
    const list = updatesByMember.get(u.memberId) ?? [];
    list.push({ meetupDate: meetup.date });
    updatesByMember.set(u.memberId, list);
  }

  const projectCountByMember = new Map<Id<"members">, number>();
  for (const pm of projectMembers) {
    projectCountByMember.set(pm.memberId, (projectCountByMember.get(pm.memberId) ?? 0) + 1);
  }

  return { meetupById, meetupDates, updatesByMember, projectCountByMember };
}

function attachMetrics(
  member: Doc<"members">,
  context: Awaited<ReturnType<typeof loadMetricsContext>>,
  today: string,
): MemberWithMetrics {
  const updates = context.updatesByMember.get(member._id) ?? [];
  return {
    ...member,
    ...computeMemberMetrics({
      registerDate: member.registerDate,
      updates,
      meetupDates: context.meetupDates,
      today,
    }),
    projectCount: context.projectCountByMember.get(member._id) ?? 0,
  };
}

function lastTalkDate(
  member: MemberWithMetrics,
  context: Awaited<ReturnType<typeof loadMetricsContext>>,
): string {
  const updates = context.updatesByMember.get(member._id) ?? [];
  return updates.map((u) => u.meetupDate).sort().at(-1) ?? "";
}

export type MemberSortBy =
  | "recent_talks"
  | "name_asc"
  | "name_desc"
  | "longest_silent"
  | "most_talks";

/** Shared by members.list and dashboard.summary (which can't use ctx.runQuery on api.* without circular types). */
export async function listMembersInner(
  ctx: QueryCtx,
  args: {
    /** undefined = all members; true/false filters on isActive. */
    isActive?: boolean;
    sortBy?: MemberSortBy;
    page?: number;
    pageSize?: number;
  },
) {
  {
    const sortBy = args.sortBy ?? "recent_talks";
    const page = Math.max(1, args.page ?? 1);
    const pageSize = args.pageSize ?? PAGE_SIZE;

    const all = await ctx.db.query("members").collect();
    const filtered =
      args.isActive === undefined ? all : all.filter((m) => m.isActive === args.isActive);

    const context = await loadMetricsContext(ctx);
    const today = todayISO();
    const withMetrics = filtered.map((m) => attachMetrics(m, context, today));

    withMetrics.sort((a, b) => {
      switch (sortBy) {
        case "name_asc":
          return a.name.localeCompare(b.name);
        case "name_desc":
          return b.name.localeCompare(a.name);
        case "longest_silent":
          return b.meetupsSinceLastTalk - a.meetupsSinceLastTalk;
        case "most_talks":
          return b.totalUpdates - a.totalUpdates;
        case "recent_talks":
        default: {
          const byLastTalk = lastTalkDate(b, context).localeCompare(lastTalkDate(a, context));
          return byLastTalk !== 0 ? byLastTalk : b.registerDate.localeCompare(a.registerDate);
        }
      }
    });

    const total = withMetrics.length;
    const totalPages = Math.max(1, Math.ceil(total / pageSize));
    const data = withMetrics.slice((page - 1) * pageSize, page * pageSize);
    return { data, totalPages, total };
  }
}

export const list = query({
  args: {
    token: v.string(),
    isActive: v.optional(v.boolean()),
    sortBy: v.optional(
      v.union(
        v.literal("recent_talks"),
        v.literal("name_asc"),
        v.literal("name_desc"),
        v.literal("longest_silent"),
        v.literal("most_talks"),
      ),
    ),
    page: v.optional(v.number()),
    pageSize: v.optional(v.number()),
  },
  handler: async (ctx, { token, ...args }) => {
    await requireSession(ctx, token);
    return await listMembersInner(ctx, args);
  },
});

export const search = query({
  args: { token: v.string(), query: v.string() },
  handler: async (ctx, args) => {
    await requireSession(ctx, args.token);
    if (args.query.trim() === "") return [];
    const results = await ctx.db
      .query("members")
      .withSearchIndex("search_name", (q) => q.search("name", args.query))
      .take(50);
    const context = await loadMetricsContext(ctx);
    const today = todayISO();
    return results.map((m) => attachMetrics(m, context, today));
  },
});

export const get = query({
  args: { token: v.string(), id: v.id("members") },
  handler: async (ctx, { token, id }) => {
    await requireSession(ctx, token);
    const member = await ctx.db.get(id);
    if (!member) return null;

    const context = await loadMetricsContext(ctx);
    const withMetrics = attachMetrics(member, context, todayISO());

    // Projects the member belongs to, with each project's full update history
    // and roster.
    const links = await ctx.db
      .query("projectMembers")
      .withIndex("by_member", (q) => q.eq("memberId", id))
      .collect();

    const projects = [];
    for (const link of links) {
      const project = await ctx.db.get(link.projectId);
      if (!project) continue;
      const projectUpdates = await ctx.db
        .query("updates")
        .withIndex("by_project", (q) => q.eq("projectId", link.projectId))
        .collect();
      const updates = [];
      for (const u of projectUpdates) {
        const meetup = context.meetupById.get(u.meetupId);
        const updateMember = await ctx.db.get(u.memberId);
        if (!meetup) continue;
        updates.push({
          _id: u._id,
          description: u.description,
          memberId: u.memberId,
          memberName: updateMember?.name ?? "Unknown",
          meetupId: u.meetupId,
          meetupDate: meetup.date,
          meetupNumber: meetup.number,
        });
      }
      updates.sort((a, b) => b.meetupDate.localeCompare(a.meetupDate));
      const memberLinks = await ctx.db
        .query("projectMembers")
        .withIndex("by_project", (q) => q.eq("projectId", link.projectId))
        .collect();
      const memberNames = [];
      for (const ml of memberLinks) {
        const m = await ctx.db.get(ml.memberId);
        if (m) memberNames.push({ id: m._id, name: m.name });
      }
      projects.push({ ...project, updates, members: memberNames });
    }

    return { ...withMetrics, projects };
  },
});

const memberFields = {
  name: v.string(),
  email: v.string(),
  isActive: v.optional(v.boolean()),
  registerDate: v.string(),
  progressTalkNum: v.optional(v.number()),
};

export const create = mutation({
  args: { token: v.string(), ...memberFields },
  handler: async (ctx, { token, ...fields }) => {
    await requireAdmin(ctx, token);
    if (fields.name.trim() === "") throw new Error("Name is required");
    return await ctx.db.insert("members", {
      name: fields.name,
      email: fields.email,
      isActive: fields.isActive ?? false,
      registerDate: fields.registerDate,
      progressTalkNum: fields.progressTalkNum ?? 0,
      updatedAt: Date.now(),
    });
  },
});

export const update = mutation({
  args: {
    token: v.string(),
    id: v.id("members"),
    name: v.optional(v.string()),
    email: v.optional(v.string()),
    isActive: v.optional(v.boolean()),
    registerDate: v.optional(v.string()),
    progressTalkNum: v.optional(v.number()),
  },
  handler: async (ctx, { token, id, ...fields }) => {
    await requireAdmin(ctx, token);
    const existing = await ctx.db.get(id);
    if (!existing) throw new Error("Member not found");
    const patch: Record<string, unknown> = { updatedAt: Date.now() };
    for (const [key, value] of Object.entries(fields)) {
      if (value !== undefined) patch[key] = value;
    }
    await ctx.db.patch(id, patch);
    return null;
  },
});

export const remove = mutation({
  args: { token: v.string(), id: v.id("members") },
  handler: async (ctx, { token, id }) => {
    await requireAdmin(ctx, token);

    // Delete the member's updates.
    const memberUpdates = await ctx.db
      .query("updates")
      .withIndex("by_member", (q) => q.eq("memberId", id))
      .collect();
    for (const u of memberUpdates) {
      await ctx.db.delete(u._id);
    }

    // Remove project memberships; delete any project left with zero members
    // (along with that project's remaining updates).
    const links = await ctx.db
      .query("projectMembers")
      .withIndex("by_member", (q) => q.eq("memberId", id))
      .collect();
    for (const link of links) {
      await ctx.db.delete(link._id);
      const remaining = await ctx.db
        .query("projectMembers")
        .withIndex("by_project", (q) => q.eq("projectId", link.projectId))
        .first();
      if (remaining === null) {
        const orphanUpdates = await ctx.db
          .query("updates")
          .withIndex("by_project", (q) => q.eq("projectId", link.projectId))
          .collect();
        for (const u of orphanUpdates) {
          await ctx.db.delete(u._id);
        }
        await ctx.db.delete(link.projectId);
      }
    }

    await ctx.db.delete(id);
    return null;
  },
});
