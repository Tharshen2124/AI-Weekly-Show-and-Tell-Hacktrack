import { v } from "convex/values";
import { mutation, query, QueryCtx } from "./_generated/server";
import { Doc, Id } from "./_generated/dataModel";
import { meetupCategoryValidator } from "./schema";
import { requireAdmin, requireSession } from "./lib/session";

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
      category: u.category,
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
  const host = meetup.hostId ? await ctx.db.get(meetup.hostId) : null;
  const updates = await updatesForMeetup(ctx, meetup._id);
  return { ...meetup, hostName: host?.name ?? null, updates, updateCount: updates.length };
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
    const regular = all
      .filter((m) => m.category === "regular_meetup")
      .sort((a, b) => b.date.localeCompare(a.date) || b.number - a.number);
    const hackathons = all
      .filter((m) => m.category === "hackathon")
      .sort((a, b) => b.date.localeCompare(a.date) || b.number - a.number);

    const totalPages = Math.max(
      1,
      Math.ceil(Math.max(regular.length, hackathons.length) / pageSize),
    );
    const slice = <T,>(items: T[]) => items.slice((page - 1) * pageSize, page * pageSize);

    const regularMeetups = [];
    for (const m of slice(regular)) regularMeetups.push(await enrichMeetup(ctx, m));
    const hackathonMeetups = [];
    for (const m of slice(hackathons)) hackathonMeetups.push(await enrichMeetup(ctx, m));

    return { regularMeetups, hackathons: hackathonMeetups, totalPages };
  }
}

export const list = query({
  args: {
    token: v.string(),
    page: v.optional(v.number()),
    pageSize: v.optional(v.number()),
  },
  handler: async (ctx, { token, ...args }) => {
    await requireSession(ctx, token);
    return await listMeetupsInner(ctx, args);
  },
});

export const get = query({
  args: { token: v.string(), id: v.id("meetups") },
  handler: async (ctx, { token, id }) => {
    await requireSession(ctx, token);
    const meetup = await ctx.db.get(id);
    if (!meetup) return null;
    return await enrichMeetup(ctx, meetup);
  },
});

export const nextNumbers = query({
  args: { token: v.string() },
  handler: async (ctx, { token }) => {
    await requireSession(ctx, token);
    const all = await ctx.db.query("meetups").collect();
    const maxFor = (category: Doc<"meetups">["category"]) =>
      all
        .filter((m) => m.category === category)
        .reduce((max, m) => Math.max(max, m.number), 0);
    return {
      regularMeetup: maxFor("regular_meetup") + 1,
      hackathon: maxFor("hackathon") + 1,
    };
  },
});

export const hostOptions = query({
  args: { token: v.string() },
  handler: async (ctx, { token }) => {
    await requireSession(ctx, token);
    const members = await ctx.db.query("members").collect();
    const active = members
      .filter((m) => m.active)
      .sort((a, b) => a.name.localeCompare(b.name));
    const meetups = await ctx.db.query("meetups").collect();
    const hostIds = new Set(meetups.map((m) => m.hostId).filter(Boolean));
    const toRef = (m: Doc<"members">) => ({ id: m._id, name: m.name });
    return {
      yetToHost: active.filter((m) => !hostIds.has(m._id)).map(toRef),
      haveHosted: active.filter((m) => hostIds.has(m._id)).map(toRef),
    };
  },
});

const meetupFields = {
  date: v.string(),
  category: meetupCategoryValidator,
  number: v.number(),
  hostId: v.optional(v.id("members")),
};

export const create = mutation({
  args: { token: v.string(), ...meetupFields },
  handler: async (ctx, { token, ...fields }) => {
    await requireAdmin(ctx, token);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(fields.date)) {
      throw new Error("Date must be YYYY-MM-DD");
    }
    return await ctx.db.insert("meetups", fields);
  },
});

export const update = mutation({
  args: {
    token: v.string(),
    id: v.id("meetups"),
    date: v.optional(v.string()),
    category: v.optional(meetupCategoryValidator),
    number: v.optional(v.number()),
    hostId: v.optional(v.union(v.id("members"), v.null())),
  },
  handler: async (ctx, { token, id, hostId, ...fields }) => {
    await requireAdmin(ctx, token);
    const existing = await ctx.db.get(id);
    if (!existing) throw new Error("Meetup not found");
    const patch: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(fields)) {
      if (value !== undefined) patch[key] = value;
    }
    if (hostId !== undefined) patch.hostId = hostId ?? undefined;
    await ctx.db.patch(id, patch);
    return null;
  },
});

export const remove = mutation({
  args: { token: v.string(), id: v.id("meetups") },
  handler: async (ctx, { token, id }) => {
    await requireAdmin(ctx, token);
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
