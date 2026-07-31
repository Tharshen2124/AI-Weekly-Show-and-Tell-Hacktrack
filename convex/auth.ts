import { v } from "convex/values";
import { mutation, query } from "./_generated/server";

/** Constant-time string comparison to avoid leaking password prefixes via timing. */
function constantTimeEqual(a: string, b: string): boolean {
  const enc = new TextEncoder();
  const ab = enc.encode(a);
  const bb = enc.encode(b);
  let diff = ab.length ^ bb.length;
  const len = Math.max(ab.length, bb.length);
  for (let i = 0; i < len; i++) {
    diff |= (ab[i % ab.length] ?? 0) ^ (bb[i % bb.length] ?? 0);
  }
  return diff === 0;
}

function randomToken(): string {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
}

const TWELVE_HOURS_MS = 12 * 60 * 60 * 1000;
const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000;

export const login = mutation({
  args: { password: v.string(), rememberMe: v.boolean() },
  handler: async (ctx, { password, rememberMe }) => {
    const adminPassword = process.env.ADMIN_PASSWORD;
    const memberPassword = process.env.MEMBER_PASSWORD;
    if (!adminPassword || !memberPassword) {
      throw new Error("Server is not configured: missing password env vars");
    }

    const isAdmin = constantTimeEqual(password, adminPassword);
    const isMember = constantTimeEqual(password, memberPassword);
    if (!isAdmin && !isMember) {
      throw new Error("Invalid password");
    }

    const token = randomToken();
    const expiresAt = Date.now() + (rememberMe ? THIRTY_DAYS_MS : TWELVE_HOURS_MS);
    await ctx.db.insert("sessions", { token, isAdmin, expiresAt });
    return { token, isAdmin, expiresAt };
  },
});

export const logout = mutation({
  args: { token: v.string() },
  handler: async (ctx, { token }) => {
    const session = await ctx.db
      .query("sessions")
      .withIndex("by_token", (q) => q.eq("token", token))
      .unique();
    if (session) {
      await ctx.db.delete(session._id);
    }
    return null;
  },
});

export const check = query({
  args: { token: v.string() },
  handler: async (ctx, { token }) => {
    const session = await ctx.db
      .query("sessions")
      .withIndex("by_token", (q) => q.eq("token", token))
      .unique();
    if (!session || session.expiresAt < Date.now()) {
      return { valid: false, isAdmin: false };
    }
    return { valid: true, isAdmin: session.isAdmin };
  },
});
