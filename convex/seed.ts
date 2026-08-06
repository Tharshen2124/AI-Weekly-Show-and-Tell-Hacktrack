import { internalMutation } from "./_generated/server";
import { Id } from "./_generated/dataModel";

// Deterministic PRNG so reseeding produces the same data.
function mulberry32(seed: number) {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const FIRST_NAMES = [
  "Aiman", "Mei Ling", "Arjun", "Nurul", "Wei Jian", "Siti", "Hafiz", "Kavya",
  "Jun Hao", "Aisyah", "Daniel", "Priya", "Zhi Yang", "Farah", "Imran", "Shalini",
  "Kai Xin", "Amirul", "Devi", "Chee Keong", "Zara", "Harith", "Yasmin", "Vikram",
  "Li Wen", "Syafiq", "Anand", "Nadia", "Jia Yi", "Ridzuan", "Tanya", "Ho Ming",
  "Alia", "Ganesh", "Xin Yi", "Firdaus", "Meera", "Chong Wei", "Balqis", "Rajesh",
];
const LAST_NAMES = [
  "Tan", "Abdullah", "Lim", "Kumar", "Wong", "Ismail", "Lee", "Raj",
  "Ng", "Hassan", "Chan", "Pillai", "Ooi", "Rahman", "Teo", "Nair",
  "Yap", "Zulkifli", "Subramaniam", "Cheah", "Aziz", "Goh", "Menon", "Chin",
  "Bakar", "Loh", "Krishnan", "Yusof", "Khoo", "Osman", "Sharma", "Foo",
  "Hamid", "Iyer", "Sim", "Kamal", "Das", "Liew", "Zainal", "Rao",
];
const PROJECT_NAMES = [
  "Pasar Price Tracker", "Teh Tarik Timer", "LRT Live Map", "Makan Roulette",
  "Durian Grader", "Batik Pattern Gen", "Kampung Mesh Net", "Haze Alert Bot",
  "Warung POS", "Rojak Recipe AI", "Monsoon Sensor", "Angkasa Sat Tracker",
  "Wau Flight Sim", "Ringgit Budgeter", "Jalan Pothole Map", "Sarawak Birdsong ID",
  "Nasi Lemak Rater", "Gotong-Royong App", "Silat Motion Capture", "Petai Inventory",
  "Cendol Queue Bot", "Merdeka Countdown", "Rambutan Sorter", "Kopitiam Kiosk",
  "Belacan Fermentometer", "Songket Loom CNC", "Mamak Order Voice", "Tanjung Tide Chart",
  "Kancil Dashcam AI", "Orang Utan Cam",
];
const UPDATE_SNIPPETS = [
  "Walked through the new architecture and the tradeoffs made.",
  "Demoed the first working prototype; latency is still an issue.",
  "Shared lessons from rewriting the data layer over the weekend.",
  "Showed benchmark results before and after the caching change.",
  "Talked through the hardware BOM and where to source parts locally.",
  "Presented the mobile UI redesign and gathered feedback.",
  "Explained how the scraping pipeline survives site changes now.",
  "Live-debugged the sensor calibration on stage.",
  "Covered the deployment setup and monthly running costs.",
  "Pitched the initial idea and the problem it solves.",
  "Outlined the roadmap for the next quarter.",
  "Showed the failed experiments and what was learned.",
];

function isoDaysAgo(days: number): string {
  return new Date(Date.now() - days * 86_400_000).toISOString().slice(0, 10);
}

export default internalMutation({
  args: {},
  handler: async (ctx) => {
    // Refuse to double-seed.
    const existing = await ctx.db.query("members").first();
    if (existing) {
      throw new Error("Database already has data; seed aborted.");
    }
    const rand = mulberry32(20260731);
    const pick = <T,>(arr: T[]): T => arr[Math.floor(rand() * arr.length)];
    const now = Date.now();

    // ~40 members
    const memberIds: Id<"members">[] = [];
    for (let i = 0; i < 40; i++) {
      const name = `${FIRST_NAMES[i]} ${LAST_NAMES[i]}`;
      const id = await ctx.db.insert("members", {
        name,
        email: `${name.toLowerCase().replace(/[^a-z]+/g, ".")}@example.com`,
        isActive: rand() > 0.4,
        registerDate: isoDaysAgo(Math.floor(rand() * 700) + 30),
        progressTalkNum: Math.floor(rand() * 12),
        updatedAt: now,
      });
      memberIds.push(id);
    }

    // ~45 weekly meetups
    const meetupIds: Id<"meetups">[] = [];
    for (let n = 1; n <= 45; n++) {
      meetupIds.push(
        await ctx.db.insert("meetups", {
          date: isoDaysAgo((45 - n) * 7 + 2),
          number: n,
          updatedAt: now,
        }),
      );
    }

    // ~30 projects with 1-4 members each; category follows the roster size.
    const projectIds: Id<"projects">[] = [];
    const projectMemberMap = new Map<Id<"projects">, Id<"members">[]>();
    for (let i = 0; i < 30; i++) {
      const memberCount = rand() > 0.6 ? Math.floor(rand() * 3) + 2 : 1;
      const id = await ctx.db.insert("projects", {
        name: PROJECT_NAMES[i],
        category: memberCount > 1 ? "group" : "solo",
        completed: rand() > 0.7,
        updatedAt: now,
      });
      const chosen = new Set<Id<"members">>();
      while (chosen.size < memberCount) chosen.add(pick(memberIds));
      for (const memberId of chosen) {
        await ctx.db.insert("projectMembers", { projectId: id, memberId });
      }
      projectIds.push(id);
      projectMemberMap.set(id, [...chosen]);
    }

    // ~200 updates: pick a project, then one of its members, then a meetup
    for (let i = 0; i < 200; i++) {
      const projectId = pick(projectIds);
      const projectMembers = projectMemberMap.get(projectId)!;
      await ctx.db.insert("updates", {
        meetupId: pick(meetupIds),
        projectId,
        memberId: pick(projectMembers),
        description: pick(UPDATE_SNIPPETS),
        updatedAt: now,
      });
    }

    return "Seeded: 40 members, 45 meetups, 30 projects, 200 updates";
  },
});
