import { v } from "convex/values";
import { mutation, query, QueryCtx } from "../_generated/server";
import { Doc, Id } from "../_generated/dataModel";
import { requireAdmin, requireMember } from "../lib/auth";

const PAGE_SIZE = 28;

async function updatesForMeetup(ctx: QueryCtx, meetupId: Id<"meetups">) {
  const updates = await ctx.db
    .query("updates")
    .withIndex("by_meetup", (q) => q.eq("meetupId", meetupId))
    .collect();
  const enriched = [];
  for (const u of updates) {
    const [member, project] = await Promise.all([
      ctx.db.get(u.memberId),
      ctx.db.get(u.projectId),
    ]);
    enriched.push({
      _id: u._id,
      description: u.description,
      memberId: u.memberId,
      memberName: member?.name ?? "Unknown",
      projectId: u.projectId,
      projectName: project?.name ?? "Unknown",
    });
  }
  return enriched;
}

async function enrichMeetup(ctx: QueryCtx, meetup: Doc<"meetups">) {
  const updates = await updatesForMeetup(ctx, meetup._id);
  return { ...meetup, updates, updateCount: updates.length };
}

/** Shared by meetups.list and dashboard.summary. */
export async function listMeetupsInner(
  ctx: QueryCtx,
  args: { page?: number; pageSize?: number },
) {
  {
    const page = Math.max(1, args.page ?? 1);
    const pageSize = args.pageSize ?? PAGE_SIZE;

    const all = await ctx.db.query("meetups").collect();
    all.sort((a, b) => b.date.localeCompare(a.date) || b.number - a.number);

    const totalPages = Math.max(1, Math.ceil(all.length / pageSize));
    const meetups = [];
    for (const m of all.slice((page - 1) * pageSize, page * pageSize)) {
      meetups.push(await enrichMeetup(ctx, m));
    }

    return { meetups, totalPages };
  }
}

export const list = query({
  args: {
    page: v.optional(v.number()),
    pageSize: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    await requireMember(ctx);
    return await listMeetupsInner(ctx, args);
  },
});

export const get = query({
  args: { id: v.id("meetups") },
  handler: async (ctx, { id }) => {
    await requireMember(ctx);
    const meetup = await ctx.db.get(id);
    if (!meetup) return null;
    return await enrichMeetup(ctx, meetup);
  },
});

export const nextNumber = query({
  args: {},
  handler: async (ctx) => {
    await requireMember(ctx);
    const all = await ctx.db.query("meetups").collect();
    return all.reduce((max, m) => Math.max(max, m.number), 0) + 1;
  },
});

const meetupFields = {
  date: v.string(),
  number: v.number(),
};

export const create = mutation({
  args: { ...meetupFields },
  handler: async (ctx, fields) => {
    await requireAdmin(ctx);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(fields.date)) {
      throw new Error("Date must be YYYY-MM-DD");
    }
    return await ctx.db.insert("meetups", { ...fields, updatedAt: Date.now() });
  },
});

export const update = mutation({
  args: {
    id: v.id("meetups"),
    date: v.optional(v.string()),
    number: v.optional(v.number()),
  },
  handler: async (ctx, { id, ...fields }) => {
    await requireAdmin(ctx);
    const existing = await ctx.db.get(id);
    if (!existing) throw new Error("Meetup not found");
    const patch: Record<string, unknown> = { updatedAt: Date.now() };
    for (const [key, value] of Object.entries(fields)) {
      if (value !== undefined) patch[key] = value;
    }
    await ctx.db.patch(id, patch);
    return null;
  },
});

export const remove = mutation({
  args: { id: v.id("meetups") },
  handler: async (ctx, { id }) => {
    await requireAdmin(ctx);
    const updates = await ctx.db
      .query("updates")
      .withIndex("by_meetup", (q) => q.eq("meetupId", id))
      .collect();
    for (const u of updates) {
      await ctx.db.delete(u._id);
    }
    await ctx.db.delete(id);
    return null;
  },
});
