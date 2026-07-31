export const MEMBER_STATUS_LABELS = {
  registered: "Registered",
  contacted: "Contacted",
  first_talk_given: "First Talk Given",
  never_active: "Never Active",
  active: "Active",
  socially_active: "Socially Active",
  was_active: "Was Active",
  was_socially_active: "Was Socially Active",
  terminated: "Terminated",
  duplicate: "Duplicate",
} as const;

export type MemberStatus = keyof typeof MEMBER_STATUS_LABELS;

export const ALL_MEMBER_STATUSES = Object.keys(MEMBER_STATUS_LABELS) as MemberStatus[];

export const MEETUP_CATEGORY_LABELS = {
  regular_meetup: "Regular Meetup",
  hackathon: "Hackathon",
  off_record_meetup: "Off-Record Meetup",
} as const;

export type MeetupCategory = keyof typeof MEETUP_CATEGORY_LABELS;

export const PROJECT_CATEGORY_LABELS = {
  project: "Project",
  mini_project: "Mini Project",
  group_project: "Group Project",
} as const;

export type ProjectCategory = keyof typeof PROJECT_CATEGORY_LABELS;

export const UPDATE_CATEGORY_LABELS = {
  idea_talk: "Idea Talk",
  progress_talk: "Progress Talk",
} as const;

export type UpdateCategory = keyof typeof UPDATE_CATEGORY_LABELS;

export const MEMBER_SORT_LABELS = {
  recent_talks: "Recently active",
  name_asc: "Name A–Z",
  name_desc: "Name Z–A",
  longest_silent: "Longest silent",
  most_talks: "Most talks",
} as const;

export type MemberSort = keyof typeof MEMBER_SORT_LABELS;
