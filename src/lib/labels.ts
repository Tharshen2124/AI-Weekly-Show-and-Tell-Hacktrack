export const PROJECT_CATEGORY_LABELS = {
  solo: "Solo",
  group: "Group",
} as const;

export type ProjectCategory = keyof typeof PROJECT_CATEGORY_LABELS;

export const MEMBER_ACTIVE_FILTER_LABELS = {
  active: "Active",
  inactive: "Inactive",
  all: "All members",
} as const;

export type MemberActiveFilter = keyof typeof MEMBER_ACTIVE_FILTER_LABELS;

export const MEMBER_SORT_LABELS = {
  recent_talks: "Recently active",
  name_asc: "Name A–Z",
  name_desc: "Name Z–A",
  longest_silent: "Longest silent",
  most_talks: "Most talks",
} as const;

export type MemberSort = keyof typeof MEMBER_SORT_LABELS;
