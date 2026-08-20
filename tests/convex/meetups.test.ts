import { convexTest } from "convex-test";
import { describe, expect, it } from "vitest";
import { api } from "../../convex/_generated/api";
import schema from "../../convex/schema";
import { modules } from "./test.setup";
import { seedAccess } from "./seed";

/** Inserts meetups numbered 1..dates.length, in the order the dates are given. */
async function seedMeetups(t: ReturnType<typeof convexTest>, dates: string[]) {
  await t.run(async (ctx) => {
    let number = 1;
    for (const date of dates) {
      await ctx.db.insert("meetups", { date, number: number++, updatedAt: Date.now() });
    }
  });
}

describe("meetups.list authorization", () => {
  it("rejects anonymous callers", async () => {
    const t = convexTest(schema, modules);
    await seedAccess(t);
    await expect(t.query(api.functions.meetups.list, {})).rejects.toThrow("Unauthorized");
  });
});

describe("meetups.list date range", () => {
  const JULY = ["2026-07-07", "2026-07-14", "2026-07-21", "2026-07-28"];

  it("includes meetups falling on both bounds", async () => {
    const t = convexTest(schema, modules);
    const { member } = await seedAccess(t);
    await seedMeetups(t, JULY);

    const result = await member.query(api.functions.meetups.list, {
      from: "2026-07-14",
      to: "2026-07-21",
    });
    // Both endpoints are meetup dates, so an exclusive range would drop them.
    expect(result.meetups.map((m) => m.date)).toEqual(["2026-07-21", "2026-07-14"]);
  });

  it("leaves the end open when only `from` is given", async () => {
    const t = convexTest(schema, modules);
    const { member } = await seedAccess(t);
    await seedMeetups(t, JULY);

    const result = await member.query(api.functions.meetups.list, { from: "2026-07-21" });
    expect(result.meetups.map((m) => m.date)).toEqual(["2026-07-28", "2026-07-21"]);
  });

  it("leaves the start open when only `to` is given", async () => {
    const t = convexTest(schema, modules);
    const { member } = await seedAccess(t);
    await seedMeetups(t, JULY);

    const result = await member.query(api.functions.meetups.list, { to: "2026-07-14" });
    expect(result.meetups.map((m) => m.date)).toEqual(["2026-07-14", "2026-07-07"]);
  });

  it("matches a whole month without knowing the exact dates", async () => {
    const t = convexTest(schema, modules);
    const { member } = await seedAccess(t);
    await seedMeetups(t, ["2026-06-30", ...JULY, "2026-08-04"]);

    const result = await member.query(api.functions.meetups.list, {
      from: "2026-07-01",
      to: "2026-07-31",
    });
    expect(result.meetups).toHaveLength(4);
    expect(result.meetups.every((m) => m.date.startsWith("2026-07"))).toBe(true);
  });

  it("treats cleared, blank, or omitted bounds as no filter", async () => {
    const t = convexTest(schema, modules);
    const { member } = await seedAccess(t);
    await seedMeetups(t, JULY);

    const omitted = await member.query(api.functions.meetups.list, {});
    const cleared = await member.query(api.functions.meetups.list, { from: "", to: "" });
    const blank = await member.query(api.functions.meetups.list, { from: "  ", to: "  " });
    expect(omitted.meetups).toHaveLength(4);
    expect(cleared).toEqual(omitted);
    expect(blank).toEqual(omitted);
  });

  it("returns nothing when the range covers no meetup", async () => {
    const t = convexTest(schema, modules);
    const { member } = await seedAccess(t);
    await seedMeetups(t, JULY);

    const result = await member.query(api.functions.meetups.list, {
      from: "2026-07-15",
      to: "2026-07-20",
    });
    expect(result.meetups).toEqual([]);
    expect(result.totalPages).toBe(1);
  });

  it("returns nothing when the bounds are inverted", async () => {
    const t = convexTest(schema, modules);
    const { member } = await seedAccess(t);
    await seedMeetups(t, JULY);

    const result = await member.query(api.functions.meetups.list, {
      from: "2026-07-28",
      to: "2026-07-07",
    });
    expect(result.meetups).toEqual([]);
  });

  it("orders same-date meetups by the higher number first", async () => {
    const t = convexTest(schema, modules);
    const { member } = await seedAccess(t);
    await seedMeetups(t, ["2026-07-14", "2026-07-14", "2026-07-21"]);

    const result = await member.query(api.functions.meetups.list, {
      from: "2026-07-14",
      to: "2026-07-14",
    });
    expect(result.meetups.map((m) => m.number)).toEqual([2, 1]);
  });

  it("pages the filtered set, not the table", async () => {
    const t = convexTest(schema, modules);
    const { member } = await seedAccess(t);
    await seedMeetups(t, [...JULY, "2026-08-04", "2026-08-11"]);

    const result = await member.query(api.functions.meetups.list, {
      from: "2026-07-01",
      to: "2026-07-31",
      pageSize: 3,
    });
    expect(result.meetups).toHaveLength(3);
    expect(result.totalPages).toBe(2);
  });

  it("keeps the enriched update count when filtering", async () => {
    const t = convexTest(schema, modules);
    const { member } = await seedAccess(t);

    await t.run(async (ctx) => {
      const memberId = await ctx.db.insert("members", {
        name: "Ana",
        email: "ana@example.com",
        isActive: true,
        registerDate: "2026-01-01",
        updatedAt: Date.now(),
      });
      const projectId = await ctx.db.insert("projects", {
        name: "Thing",
        category: "solo" as const,
        completed: false,
        updatedAt: Date.now(),
      });
      const wanted = await ctx.db.insert("meetups", {
        date: "2026-07-14",
        number: 1,
        updatedAt: Date.now(),
      });
      const other = await ctx.db.insert("meetups", {
        date: "2026-07-21",
        number: 2,
        updatedAt: Date.now(),
      });
      for (const meetupId of [wanted, wanted, other]) {
        await ctx.db.insert("updates", {
          meetupId,
          projectId,
          memberId,
          description: "talk",
          updatedAt: Date.now(),
        });
      }
    });

    const result = await member.query(api.functions.meetups.list, {
      from: "2026-07-14",
      to: "2026-07-14",
    });
    expect(result.meetups).toHaveLength(1);
    expect(result.meetups[0].updateCount).toBe(2);
    expect(result.meetups[0].updates).toHaveLength(2);
  });
});
