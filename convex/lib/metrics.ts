// Derived member engagement metrics (spec §3.6). Pure functions so they can be
// unit-tested without a Convex runtime. All dates are ISO YYYY-MM-DD strings and
// are compared lexicographically, which is safe for that format.

export type MeetupCategory = "regular_meetup" | "hackathon" | "off_record_meetup";
export type UpdateCategory = "idea_talk" | "progress_talk";

export interface UpdateForMetrics {
  category: UpdateCategory;
  meetupDate: string; // YYYY-MM-DD
  meetupCategory: MeetupCategory;
}

export interface MemberMetrics {
  progressTalkCount: number;
  ideaTalkCount: number;
  totalUpdates: number;
  durationActive: string;
  avgTimeBetweenTalks: string | null;
  meetupsSinceLastTalk: number;
}

function parseUtc(date: string): number {
  const [y, m, d] = date.split("-").map(Number);
  return Date.UTC(y, m - 1, d);
}

export function daysBetween(a: string, b: string): number {
  return Math.round((parseUtc(b) - parseUtc(a)) / 86_400_000);
}

function wholeMonthsBetween(a: string, b: string): number {
  const [ay, am, ad] = a.split("-").map(Number);
  const [by, bm, bd] = b.split("-").map(Number);
  let months = (by - ay) * 12 + (bm - am);
  if (bd < ad) months -= 1;
  return Math.max(0, months);
}

export function formatDuration(fromDate: string, toDate: string): string {
  const months = wholeMonthsBetween(fromDate, toDate);
  if (months < 1) return "New";
  const years = Math.floor(months / 12);
  const rest = months % 12;
  const parts: string[] = [];
  if (years > 0) parts.push(`${years} ${years === 1 ? "year" : "years"}`);
  if (rest > 0) parts.push(`${rest} ${rest === 1 ? "month" : "months"}`);
  return parts.join(" ");
}

export function computeMemberMetrics(args: {
  registerDate: string;
  updates: UpdateForMetrics[];
  /** Dates of every regular_meetup, any order. */
  regularMeetupDates: string[];
  /** Today as YYYY-MM-DD; injectable for tests. */
  today: string;
}): MemberMetrics {
  const { registerDate, regularMeetupDates, today } = args;

  // off_record_meetup is excluded from every metric.
  const updates = args.updates.filter((u) => u.meetupCategory !== "off_record_meetup");
  const dates = updates.map((u) => u.meetupDate).sort();

  const progressTalkCount = updates.filter((u) => u.category === "progress_talk").length;
  const ideaTalkCount = updates.filter((u) => u.category === "idea_talk").length;
  const totalUpdates = updates.length;

  const firstTalkDate = dates[0];
  const activeSince =
    firstTalkDate && firstTalkDate < registerDate ? firstTalkDate : registerDate;
  const durationActive = formatDuration(activeSince, today);

  let avgTimeBetweenTalks: string | null = null;
  if (dates.length >= 2) {
    let totalGap = 0;
    for (let i = 1; i < dates.length; i++) {
      totalGap += daysBetween(dates[i - 1], dates[i]);
    }
    avgTimeBetweenTalks = `~${Math.round(totalGap / (dates.length - 1))} days`;
  }

  const lastTalkDate = dates[dates.length - 1];
  const meetupsSinceLastTalk = lastTalkDate
    ? regularMeetupDates.filter((d) => d > lastTalkDate).length
    : regularMeetupDates.filter((d) => d >= registerDate).length;

  return {
    progressTalkCount,
    ideaTalkCount,
    totalUpdates,
    durationActive,
    avgTimeBetweenTalks,
    meetupsSinceLastTalk,
  };
}
