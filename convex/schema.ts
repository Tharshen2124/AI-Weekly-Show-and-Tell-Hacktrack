import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export const projectCategoryValidator = v.union(v.literal("solo"), v.literal("group"));

// created_at is covered by Convex's built-in _creationTime; updatedAt is
// maintained by every mutation that writes the row.
export default defineSchema({
  members: defineTable({
    name: v.string(),
    email: v.string(),
    isActive: v.boolean(),
    registerDate: v.string(), // YYYY-MM-DD
    progressTalkNum: v.number(),
    updatedAt: v.number(), // epoch ms
  })
    .index("by_name", ["name"])
    .searchIndex("search_name", { searchField: "name", filterFields: ["isActive"] }),

  meetups: defineTable({
    date: v.string(), // YYYY-MM-DD
    number: v.number(),
    updatedAt: v.number(),
  }).index("by_date", ["date"]),

  projects: defineTable({
    name: v.string(),
    category: projectCategoryValidator, // "solo" | "group"
    completed: v.boolean(),
    updatedAt: v.number(),
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
    description: v.string(),
    updatedAt: v.number(),
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
