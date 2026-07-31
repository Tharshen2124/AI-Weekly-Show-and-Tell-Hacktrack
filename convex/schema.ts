import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export const memberStatusValidator = v.union(
  v.literal("registered"),
  v.literal("contacted"),
  v.literal("first_talk_given"),
  v.literal("never_active"),
  v.literal("active"),
  v.literal("socially_active"),
  v.literal("was_active"),
  v.literal("was_socially_active"),
  v.literal("terminated"),
  v.literal("duplicate"),
);

export const meetupCategoryValidator = v.union(
  v.literal("regular_meetup"),
  v.literal("hackathon"),
  v.literal("off_record_meetup"),
);

export const projectCategoryValidator = v.union(
  v.literal("project"),
  v.literal("mini_project"),
  v.literal("group_project"),
);

export const updateCategoryValidator = v.union(
  v.literal("idea_talk"),
  v.literal("progress_talk"),
);

export default defineSchema({
  members: defineTable({
    name: v.string(),
    email: v.string(),
    contactNumber: v.optional(v.string()),
    discordTag: v.optional(v.string()),
    status: memberStatusValidator,
    comment: v.optional(v.string()),
    registerDate: v.string(), // YYYY-MM-DD
    active: v.boolean(), // true for active | socially_active
  })
    .index("by_status", ["status"])
    .index("by_name", ["name"])
    .searchIndex("search_name", { searchField: "name", filterFields: ["status"] }),

  meetups: defineTable({
    date: v.string(), // YYYY-MM-DD
    category: meetupCategoryValidator,
    number: v.number(), // sequence number, independent per category
    hostId: v.optional(v.id("members")),
  })
    .index("by_category_and_date", ["category", "date"])
    .index("by_date", ["date"]),

  projects: defineTable({
    name: v.string(),
    category: projectCategoryValidator,
    completed: v.boolean(),
  }).index("by_name", ["name"]),

  projectMembers: defineTable({
    projectId: v.id("projects"),
    memberId: v.id("members"),
  })
    .index("by_project", ["projectId"])
    .index("by_member", ["memberId"])
    .index("by_project_and_member", ["projectId", "memberId"]),

  updates: defineTable({
    meetupId: v.id("meetups"),
    projectId: v.id("projects"),
    memberId: v.id("members"),
    category: updateCategoryValidator,
    description: v.string(),
  })
    .index("by_meetup", ["meetupId"])
    .index("by_member", ["memberId"])
    .index("by_project", ["projectId"])
    .index("by_member_and_meetup", ["memberId", "meetupId"]),

  sessions: defineTable({
    token: v.string(),
    isAdmin: v.boolean(),
    expiresAt: v.number(), // epoch ms
  }).index("by_token", ["token"]),
});
