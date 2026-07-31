import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { projectCategoryValidator } from "./schema";
import { requireAdmin, requireSession } from "./lib/session";

export const list = query({
  args: { token: v.string() },
  handler: async (ctx, { token }) => {
    await requireSession(ctx, token);
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
          .filter((m): m is { id: (typeof members)[number]["_id"]; name: string } => m !== null),
        updateCount: updateCountByProject.get(p._id) ?? 0,
      }))
      .sort((a, b) => a.name.localeCompare(b.name));
  },
});

export const create = mutation({
  args: {
    token: v.string(),
    name: v.string(),
    category: projectCategoryValidator,
    completed: v.boolean(),
    memberIds: v.array(v.id("members")),
  },
  handler: async (ctx, { token, memberIds, ...fields }) => {
    await requireAdmin(ctx, token);
    if (fields.name.trim() === "") throw new Error("Project name is required");
    if (memberIds.length === 0) {
      throw new Error("A project needs at least one member");
    }
    const projectId = await ctx.db.insert("projects", fields);
    for (const memberId of memberIds) {
      await ctx.db.insert("projectMembers", { projectId, memberId });
    }
    return projectId;
  },
});

export const update = mutation({
  args: {
    token: v.string(),
    id: v.id("projects"),
    name: v.optional(v.string()),
    category: v.optional(projectCategoryValidator),
    completed: v.optional(v.boolean()),
    memberIds: v.optional(v.array(v.id("members"))),
  },
  handler: async (ctx, { token, id, memberIds, ...fields }) => {
    await requireAdmin(ctx, token);
    const existing = await ctx.db.get(id);
    if (!existing) throw new Error("Project not found");

    const patch: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(fields)) {
      if (value !== undefined) patch[key] = value;
    }
    if (Object.keys(patch).length > 0) {
      await ctx.db.patch(id, patch);
    }

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
  args: { token: v.string(), id: v.id("projects") },
  handler: async (ctx, { token, id }) => {
    await requireAdmin(ctx, token);
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
