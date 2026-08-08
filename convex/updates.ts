import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { requireAdmin, requireMember } from "./lib/auth";
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
    meetupId: v.id("meetups"),
    projectId: v.id("projects"),
    memberId: v.id("members"),
    description: v.string(),
  },
  handler: async (ctx, fields) => {
    await requireAdmin(ctx);
    await assertMemberOnProject(ctx, fields.memberId, fields.projectId);
    return await ctx.db.insert("updates", { ...fields, updatedAt: Date.now() });
  },
});

export const update = mutation({
  args: {
    id: v.id("updates"),
    meetupId: v.optional(v.id("meetups")),
    projectId: v.optional(v.id("projects")),
    memberId: v.optional(v.id("members")),
    description: v.optional(v.string()),
  },
  handler: async (ctx, { id, ...fields }) => {
    await requireAdmin(ctx);
    const existing = await ctx.db.get(id);
    if (!existing) throw new Error("Update not found");

    const memberId = fields.memberId ?? existing.memberId;
    const projectId = fields.projectId ?? existing.projectId;
    await assertMemberOnProject(ctx, memberId, projectId);

    const patch: Record<string, unknown> = { updatedAt: Date.now() };
    for (const [key, value] of Object.entries(fields)) {
      if (value !== undefined) patch[key] = value;
    }
    await ctx.db.patch(id, patch);
    return null;
  },
});

export const remove = mutation({
  args: { id: v.id("updates") },
  handler: async (ctx, { id }) => {
    await requireAdmin(ctx);
    await ctx.db.delete(id);
    return null;
  },
});

export const formOptions = query({
  args: {},
  handler: async (ctx) => {
    await requireMember(ctx);
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
        .map((m) => ({ id: m._id, date: m.date, number: m.number })),
    };
  },
});
