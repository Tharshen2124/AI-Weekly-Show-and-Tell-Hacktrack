import { cronJobs } from "convex/server";
import { internal } from "./_generated/api";
import { internalMutation } from "./_generated/server";

export const purgeExpiredSessions = internalMutation({
  args: {},
  handler: async (ctx) => {
    const now = Date.now();
    const sessions = await ctx.db.query("sessions").collect();
    for (const session of sessions) {
      if (session.expiresAt < now) {
        await ctx.db.delete(session._id);
      }
    }
  },
});

const crons = cronJobs();

crons.daily(
  "purge expired sessions",
  { hourUTC: 3, minuteUTC: 0 },
  internal.crons.purgeExpiredSessions,
);

export default crons;
