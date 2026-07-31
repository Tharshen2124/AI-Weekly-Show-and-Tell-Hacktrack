import { v } from "convex/values";
import { query } from "./_generated/server";
import { requireSession } from "./lib/session";
import { listMeetupsInner } from "./meetups";
import { listMembersInner } from "./members";

export const summary = query({
  args: { token: v.string() },
  handler: async (ctx, { token }) => {
    await requireSession(ctx, token);

    const meetupsPage = await listMeetupsInner(ctx, { page: 1, pageSize: 4 });
    const membersPage = await listMembersInner(ctx, {
      statuses: ["active", "socially_active"],
      sortBy: "recent_talks",
      page: 1,
      pageSize: 8,
    });

    const [allMembers, allMeetups, allProjects, allUpdates] = await Promise.all([
      ctx.db.query("members").collect(),
      ctx.db.query("meetups").collect(),
      ctx.db.query("projects").collect(),
      ctx.db.query("updates").collect(),
    ]);

    return {
      recentMeetups: meetupsPage.regularMeetups,
      recentHackathons: meetupsPage.hackathons,
      activeMembers: membersPage.data,
      stats: {
        memberCount: allMembers.length,
        meetupCount: allMeetups.filter((m) => m.category !== "off_record_meetup").length,
        projectCount: allProjects.length,
        updateCount: allUpdates.length,
      },
    };
  },
});
