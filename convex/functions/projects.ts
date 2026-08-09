import { v } from "convex/values";
import { mutation, query } from "../_generated/server";
import { projectCategoryValidator } from "../schema";
import { requireAdmin, requireMember } from "../lib/auth";

const PAGE_SIZE = 15;

export const list = query({
  args: {
    /** Case-insensitive substring match on the name; blank means no filter. */
    search: v.optional(v.string()),
    page: v.optional(v.number()),
    pageSize: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    await requireMember(ctx);

    const pageSize = args.pageSize ?? PAGE_SIZE;
    const needle = (args.search ?? "").trim().toLowerCase();

    // Only `projects` is read whole: a substring match is not something an index
    // can serve, and the row count is needed for `totalPages`. Members and update
    // counts load per row *after* the slice, so they cost one page rather than
    // three full table scans.
    const all = await ctx.db.query("projects").collect();
    const matched =
      needle === "" ? all : all.filter((p) => p.name.toLowerCase().includes(needle));
    // Sorted here rather than read through `by_name`, because index order is UTF-8
    // byte order — it would put every capitalised name ahead of every lowercase
    // one ("ZeroDay" before "apple-tracker").
    matched.sort((a, b) => a.name.localeCompare(b.name));

    const total = matched.length;
    const totalPages = Math.max(1, Math.ceil(total / pageSize));
    // Clamped, not just floored the way members.list does: deleting the last row
    // of the last page would otherwise leave the client asking for a page that no
    // longer exists and getting a blank table. The page actually served comes back
    // in the result — Pagination derives prev/next from the page it is handed.
    const page = Math.min(Math.max(1, args.page ?? 1), totalPages);

    const data = await Promise.all(
      matched.slice((page - 1) * pageSize, page * pageSize).map(async (project) => {
        const [links, updates] = await Promise.all([
          ctx.db
            .query("projectMembers")
            .withIndex("by_project", (q) => q.eq("projectId", project._id))
            .collect(),
          ctx.db
            .query("updates")
            .withIndex("by_project", (q) => q.eq("projectId", project._id))
            .collect(),
        ]);
        const members = (await Promise.all(links.map((l) => ctx.db.get(l.memberId))))
          .filter((m) => m !== null)
          .map((m) => ({ id: m._id, name: m.name }))
          .sort((a, b) => a.name.localeCompare(b.name));
        return { ...project, members, updateCount: updates.length };
      }),
    );

    return { data, page, totalPages, total };
  },
});

export const get = query({
  args: { id: v.id("projects") },
  handler: async (ctx, { id }) => {
    await requireMember(ctx);
    const project = await ctx.db.get(id);
    if (!project) return null;

    const links = await ctx.db
      .query("projectMembers")
      .withIndex("by_project", (q) => q.eq("projectId", id))
      .collect();
    const members = [];
    for (const link of links) {
      const m = await ctx.db.get(link.memberId);
      if (m) members.push({ id: m._id, name: m.name });
    }
    members.sort((a, b) => a.name.localeCompare(b.name));

    const projectUpdates = await ctx.db
      .query("updates")
      .withIndex("by_project", (q) => q.eq("projectId", id))
      .collect();
    const updates = [];
    for (const u of projectUpdates) {
      const [meetup, member] = await Promise.all([
        ctx.db.get(u.meetupId),
        ctx.db.get(u.memberId),
      ]);
      if (!meetup) continue;
      updates.push({
        _id: u._id,
        description: u.description,
        memberId: u.memberId,
        memberName: member?.name ?? "Unknown",
        meetupId: u.meetupId,
        meetupNumber: meetup.number,
        meetupDate: meetup.date,
      });
    }
    updates.sort((a, b) => b.meetupDate.localeCompare(a.meetupDate));

    return { ...project, members, updates };
  },
});

export const create = mutation({
  args: {
    name: v.string(),
    category: projectCategoryValidator,
    completed: v.boolean(),
    memberIds: v.array(v.id("members")),
  },
  handler: async (ctx, { memberIds, ...fields }) => {
    await requireAdmin(ctx);
    if (fields.name.trim() === "") throw new Error("Project name is required");
    if (memberIds.length === 0) {
      throw new Error("A project needs at least one member");
    }
    const projectId = await ctx.db.insert("projects", { ...fields, updatedAt: Date.now() });
    for (const memberId of memberIds) {
      await ctx.db.insert("projectMembers", { projectId, memberId });
    }
    return projectId;
  },
});

export const update = mutation({
  args: {
    id: v.id("projects"),
    name: v.optional(v.string()),
    category: v.optional(projectCategoryValidator),
    completed: v.optional(v.boolean()),
    memberIds: v.optional(v.array(v.id("members"))),
  },
  handler: async (ctx, { id, memberIds, ...fields }) => {
    await requireAdmin(ctx);
    const existing = await ctx.db.get(id);
    if (!existing) throw new Error("Project not found");

    const patch: Record<string, unknown> = { updatedAt: Date.now() };
    for (const [key, value] of Object.entries(fields)) {
      if (value !== undefined) patch[key] = value;
    }
    await ctx.db.patch(id, patch);

    if (memberIds !== undefined) {
      if (memberIds.length === 0) {
        throw new Error("A project needs at least one member");
      }
      const links = await ctx.db
        .query("projectMembers")
        .withIndex("by_project", (q) => q.eq("projectId", id))
        .collect();
      const wanted = new Set(memberIds);
      for (const link of links) {
        if (!wanted.has(link.memberId)) {
          await ctx.db.delete(link._id);
        }
      }
      const current = new Set(links.map((l) => l.memberId));
      for (const memberId of memberIds) {
        if (!current.has(memberId)) {
          await ctx.db.insert("projectMembers", { projectId: id, memberId });
        }
      }
    }
    return null;
  },
});

export const remove = mutation({
  args: { id: v.id("projects") },
  handler: async (ctx, { id }) => {
    await requireAdmin(ctx);
    const updates = await ctx.db
      .query("updates")
      .withIndex("by_project", (q) => q.eq("projectId", id))
      .collect();
    for (const u of updates) {
      await ctx.db.delete(u._id);
    }
    const links = await ctx.db
      .query("projectMembers")
      .withIndex("by_project", (q) => q.eq("projectId", id))
      .collect();
    for (const link of links) {
      await ctx.db.delete(link._id);
    }
    await ctx.db.delete(id);
    return null;
  },
});
