import { convexTest } from "convex-test";
import { describe, expect, it } from "vitest";
import { api } from "../../convex/_generated/api";
import schema from "../../convex/schema";
import { modules } from "./test.setup";
import { memberDoc, seedAccess } from "./seed";

/** Inserts projects by name, in the order given. */
async function seedProjects(t: ReturnType<typeof convexTest>, names: string[]) {
  return await t.run(async (ctx) => {
    const ids = [];
    for (const name of names) {
      ids.push(
        await ctx.db.insert("projects", {
          name,
          category: "solo" as const,
          completed: false,
          updatedAt: Date.now(),
        }),
      );
    }
    return ids;
  });
}

/** "Project 01" … "Project 20" — zero-padded so name order is unambiguous. */
function numberedNames(count: number) {
  return Array.from({ length: count }, (_, i) => `Project ${String(i + 1).padStart(2, "0")}`);
}

describe("projects.list authorization", () => {
  it("rejects anonymous callers", async () => {
    const t = convexTest(schema, modules);
    await seedAccess(t);
    await expect(t.query(api.functions.projects.list, {})).rejects.toThrow("Unauthorized");
  });
});

describe("projects.list paging", () => {
  it("serves 15 rows per page by default", async () => {
    const t = convexTest(schema, modules);
    const { member } = await seedAccess(t);
    await seedProjects(t, numberedNames(20));

    const first = await member.query(api.functions.projects.list, {});
    expect(first.data).toHaveLength(15);
    expect(first.page).toBe(1);
    expect(first.total).toBe(20);
    expect(first.totalPages).toBe(2);

    const second = await member.query(api.functions.projects.list, { page: 2 });
    expect(second.data).toHaveLength(5);
    expect(second.page).toBe(2);
  });

  it("tiles the sorted list across pages with no gaps or duplicates", async () => {
    const t = convexTest(schema, modules);
    const { member } = await seedAccess(t);
    const names = numberedNames(5);
    await seedProjects(t, names);

    const seen = [];
    for (const page of [1, 2, 3]) {
      const result = await member.query(api.functions.projects.list, { page, pageSize: 2 });
      expect(result.totalPages).toBe(3);
      seen.push(...result.data.map((p) => p.name));
    }
    expect(seen).toEqual(names);
  });

  it("honours an explicit pageSize", async () => {
    const t = convexTest(schema, modules);
    const { member } = await seedAccess(t);
    await seedProjects(t, numberedNames(20));

    const result = await member.query(api.functions.projects.list, { pageSize: 3 });
    expect(result.data).toHaveLength(3);
    expect(result.totalPages).toBe(7);
    expect(result.total).toBe(20);
  });

  it("reports one empty page when there are no projects", async () => {
    const t = convexTest(schema, modules);
    const { member } = await seedAccess(t);

    const result = await member.query(api.functions.projects.list, {});
    expect(result).toEqual({ data: [], page: 1, totalPages: 1, total: 0 });
  });
});

describe("projects.list page clamping", () => {
  it("serves the last page instead of nothing when the page is past the end", async () => {
    const t = convexTest(schema, modules);
    const { member } = await seedAccess(t);
    await seedProjects(t, numberedNames(3));

    const result = await member.query(api.functions.projects.list, { page: 99, pageSize: 2 });
    expect(result.page).toBe(2);
    expect(result.totalPages).toBe(2);
    expect(result.data.map((p) => p.name)).toEqual(["Project 03"]);
  });

  it("floors a zero or negative page to the first page", async () => {
    const t = convexTest(schema, modules);
    const { member } = await seedAccess(t);
    await seedProjects(t, numberedNames(3));

    for (const page of [0, -5]) {
      const result = await member.query(api.functions.projects.list, { page, pageSize: 2 });
      expect(result.page).toBe(1);
      expect(result.data.map((p) => p.name)).toEqual(["Project 01", "Project 02"]);
    }
  });
});

describe("projects.list sorting", () => {
  it("sorts by locale, not by index byte order", async () => {
    const t = convexTest(schema, modules);
    const { member } = await seedAccess(t);
    await seedProjects(t, ["Banana Bot", "apple-tracker", "ZeroDay"]);

    // Byte order would give ["Banana Bot", "ZeroDay", "apple-tracker"], since
    // every uppercase letter sorts below every lowercase one.
    const result = await member.query(api.functions.projects.list, {});
    expect(result.data.map((p) => p.name)).toEqual(["apple-tracker", "Banana Bot", "ZeroDay"]);
  });
});

describe("projects.list search", () => {
  it("matches a case-insensitive substring anywhere in the name", async () => {
    const t = convexTest(schema, modules);
    const { member } = await seedAccess(t);
    await seedProjects(t, ["Data Pipeline", "pipeline-ui", "Unrelated"]);

    const result = await member.query(api.functions.projects.list, { search: "PIPE" });
    expect(result.data.map((p) => p.name)).toEqual(["Data Pipeline", "pipeline-ui"]);
  });

  it("trims surrounding whitespace", async () => {
    const t = convexTest(schema, modules);
    const { member } = await seedAccess(t);
    await seedProjects(t, ["Data Pipeline", "pipeline-ui", "Unrelated"]);

    const result = await member.query(api.functions.projects.list, { search: "  pipe  " });
    expect(result.data).toHaveLength(2);
  });

  it("treats an omitted and an empty search the same", async () => {
    const t = convexTest(schema, modules);
    const { member } = await seedAccess(t);
    await seedProjects(t, ["Data Pipeline", "pipeline-ui", "Unrelated"]);

    const omitted = await member.query(api.functions.projects.list, {});
    const blank = await member.query(api.functions.projects.list, { search: "   " });
    expect(omitted.total).toBe(3);
    expect(blank).toEqual(omitted);
  });

  it("counts the filtered set, not the table", async () => {
    const t = convexTest(schema, modules);
    const { member } = await seedAccess(t);
    await seedProjects(t, [...numberedNames(7), "Pipe A", "Pipe B", "Pipe C"]);

    const result = await member.query(api.functions.projects.list, {
      search: "pipe",
      pageSize: 2,
    });
    expect(result.total).toBe(3);
    expect(result.totalPages).toBe(2);
    expect(result.data).toHaveLength(2);
  });

  it("returns an empty page when nothing matches", async () => {
    const t = convexTest(schema, modules);
    const { member } = await seedAccess(t);
    await seedProjects(t, numberedNames(3));

    const result = await member.query(api.functions.projects.list, { search: "nothing" });
    expect(result).toEqual({ data: [], page: 1, totalPages: 1, total: 0 });
  });
});

describe("projects.list enrichment", () => {
  it("attaches name-sorted members and a per-project update count", async () => {
    const t = convexTest(schema, modules);
    const { member } = await seedAccess(t);

    await t.run(async (ctx) => {
      const zoe = await ctx.db.insert("members", memberDoc("Zoe"));
      const ana = await ctx.db.insert("members", memberDoc("Ana"));
      const busy = await ctx.db.insert("projects", {
        name: "Busy",
        category: "group" as const,
        completed: false,
        updatedAt: Date.now(),
      });
      const quiet = await ctx.db.insert("projects", {
        name: "Quiet",
        category: "solo" as const,
        completed: false,
        updatedAt: Date.now(),
      });
      await ctx.db.insert("projectMembers", { projectId: busy, memberId: zoe });
      await ctx.db.insert("projectMembers", { projectId: busy, memberId: ana });
      await ctx.db.insert("projectMembers", { projectId: quiet, memberId: ana });

      const meetupId = await ctx.db.insert("meetups", {
        date: "2026-05-01",
        number: 1,
        updatedAt: Date.now(),
      });
      for (const description of ["one", "two"]) {
        await ctx.db.insert("updates", {
          meetupId,
          projectId: busy,
          memberId: ana,
          description,
          updatedAt: Date.now(),
        });
      }
      await ctx.db.insert("updates", {
        meetupId,
        projectId: quiet,
        memberId: ana,
        description: "solo",
        updatedAt: Date.now(),
      });
    });

    const result = await member.query(api.functions.projects.list, {});
    const [busy, quiet] = result.data;
    expect(busy.name).toBe("Busy");
    expect(busy.members.map((m) => m.name)).toEqual(["Ana", "Zoe"]);
    expect(busy.updateCount).toBe(2);
    expect(quiet.updateCount).toBe(1);
  });

  it("includes a project with no members", async () => {
    const t = convexTest(schema, modules);
    const { member } = await seedAccess(t);
    await seedProjects(t, ["Orphan"]);

    const result = await member.query(api.functions.projects.list, {});
    expect(result.data).toHaveLength(1);
    expect(result.data[0].members).toEqual([]);
    expect(result.data[0].updateCount).toBe(0);
  });

  it("skips a membership link whose member no longer exists", async () => {
    const t = convexTest(schema, modules);
    const { member } = await seedAccess(t);

    await t.run(async (ctx) => {
      const ghost = await ctx.db.insert("members", memberDoc("Ghost"));
      const ana = await ctx.db.insert("members", memberDoc("Ana"));
      const projectId = await ctx.db.insert("projects", {
        name: "Haunted",
        category: "group" as const,
        completed: false,
        updatedAt: Date.now(),
      });
      await ctx.db.insert("projectMembers", { projectId, memberId: ghost });
      await ctx.db.insert("projectMembers", { projectId, memberId: ana });
      await ctx.db.delete(ghost);
    });

    const result = await member.query(api.functions.projects.list, {});
    expect(result.data[0].members.map((m) => m.name)).toEqual(["Ana"]);
  });
});
