import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { updateCategoryValidator } from "./schema";
import { requireAdmin, requireSession } from "./lib/session";
import { Id } from "./_generated/dataModel";
import { MutationCtx } from "./_generated/server";

async function assertMemberOnProject(
  ctx: MutationCtx,
  memberId: Id<"members">,
  projectId: Id<"projects">,
) {
  const link = await ctx.db
    .query("projectMembers")
    .withIndex("by_project_and_member", (q) =>
      q.eq("projectId", projectId).eq("memberId", memberId),
    )
    .unique();
  if (!link) {
    throw new Error("Member does not belong to the selected project");
  }
}

export const create = mutation({
  args: {
    token: v.string(),
    meetupId: v.id("meetups"),
    projectId: v.id("projects"),
    memberId: v.id("members"),
    category: updateCategoryValidator,
    description: v.string(),
  },
  handler: async (ctx, { token, ...fields }) => {
    await requireAdmin(ctx, token);
    await assertMemberOnProject(ctx, fields.memberId, fields.projectId);
    return await ctx.db.insert("updates", fields);
  },
});

export const update = mutation({
  args: {
    token: v.string(),
    id: v.id("updates"),
    meetupId: v.optional(v.id("meetups")),
    projectId: v.optional(v.id("projects")),
    memberId: v.optional(v.id("members")),
    category: v.optional(updateCategoryValidator),
    description: v.optional(v.string()),
  },
  handler: async (ctx, { token, id, ...fields }) => {
    await requireAdmin(ctx, token);
    const existing = await ctx.db.get(id);
    if (!existing) throw new Error("Update not found");

    const memberId = fields.memberId ?? existing.memberId;
    const projectId = fields.projectId ?? existing.projectId;
    await assertMemberOnProject(ctx, memberId, projectId);

    const patch: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(fields)) {
      if (value !== undefined) patch[key] = value;
    }
    await ctx.db.patch(id, patch);
    return null;
  },
});

export const remove = mutation({
  args: { token: v.string(), id: v.id("updates") },
  handler: async (ctx, { token, id }) => {
    await requireAdmin(ctx, token);
    await ctx.db.delete(id);
    return null;
  },
});

export const formOptions = query({
  args: { token: v.string() },
  handler: async (ctx, { token }) => {
    await requireSession(ctx, token);
    const [members, projects, links, meetups] = await Promise.all([
      ctx.db.query("members").collect(),
      ctx.db.query("projects").collect(),
      ctx.db.query("projectMembers").collect(),
      ctx.db.query("meetups").collect(),
    ]);
    const projectById = new Map(projects.map((p) => [p._id, p]));
    const memberOptions = members
      .sort((a, b) => a.name.localeCompare(b.name))
      .map((m) => ({
        id: m._id,
        name: m.name,
        projects: links
          .filter((l) => l.memberId === m._id)
          .map((l) => projectById.get(l.projectId))
          .filter((p): p is NonNullable<typeof p> => p !== undefined)
          .map((p) => ({ id: p._id, name: p.name })),
      }));
    return {
      members: memberOptions,
      meetups: meetups
        .sort((a, b) => b.date.localeCompare(a.date))
        .map((m) => ({ id: m._id, date: m.date, number: m.number, category: m.category })),
    };
  },
});
