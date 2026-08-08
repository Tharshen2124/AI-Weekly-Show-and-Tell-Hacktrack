import { query } from "./_generated/server";
import { currentMember } from "./lib/auth";

/**
 * Who the caller is as far as this app is concerned. Returns null when the
 * person is signed in with Google but holds no access level — the client shows
 * the "no access" message for that case.
 */
export const me = query({
  args: {},
  handler: async (ctx) => {
    const member = await currentMember(ctx);
    if (!member) return null;
    return {
      id: member._id,
      name: member.name,
      email: member.email,
      accessLevel: member.accessLevel,
      isAdmin: member.accessLevel === "admin",
    };
  },
});
