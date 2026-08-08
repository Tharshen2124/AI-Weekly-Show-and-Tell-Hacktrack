import { v } from "convex/values";
import { mutation, query } from "../_generated/server";
import { projectCategoryValidator } from "../schema";
import { requireAdmin, requireMember } from "../lib/auth";

export const list = query({
  args: {},
  handler: async (ctx) => {
    await requireMember(ctx);
    const [projects, links, updates, members] = await Promise.all([
      ctx.db.query("projects").collect(),
      ctx.db.query("projectMembers").collect(),
      ctx.db.query("updates").collect(),
      ctx.db.query("members").collect(),
    ]);
    const memberById = new Map(members.map((m) => [m._id, m]));
    const updateCountByProject = new Map<string, number>();
    for (const u of updates) {
      updateCountByProject.set(u.projectId, (updateCountByProject.get(u.projectId) ?? 0) + 1);
    }
    return projects
      .map((p) => ({
        ...p,
        members: links
          .filter((l) => l.projectId === p._id)
          .map((l) => {
            const m = memberById.get(l.memberId);
            return m ? { id: m._id, name: m.name } : null;
          })
          .filter((m): m is { id: (typeof members)[number]["_id"]; name: string } => m !== null)
          .sort((a, b) => a.name.localeCompare(b.name)),
        updateCount: updateCountByProject.get(p._id) ?? 0,
      }))
      .sort((a, b) => a.name.localeCompare(b.name));
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
