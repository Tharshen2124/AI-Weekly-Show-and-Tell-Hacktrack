import { describe, expect, it } from "vitest";
import { computeMemberMetrics, daysBetween, formatDuration, UpdateForMetrics } from "./metrics";

const TODAY = "2026-07-31";

function update(
  meetupDate: string,
  category: UpdateForMetrics["category"] = "progress_talk",
  meetupCategory: UpdateForMetrics["meetupCategory"] = "regular_meetup",
): UpdateForMetrics {
  return { category, meetupDate, meetupCategory };
}

describe("daysBetween", () => {
  it("counts calendar days", () => {
    expect(daysBetween("2026-01-01", "2026-01-31")).toBe(30);
    expect(daysBetween("2026-02-27", "2026-03-01")).toBe(2); // 2026 is not a leap year
  });
});

describe("formatDuration", () => {
  it("returns New under one month", () => {
    expect(formatDuration("2026-07-10", TODAY)).toBe("New");
  });
  it("formats months", () => {
    expect(formatDuration("2026-03-31", TODAY)).toBe("4 months");
    expect(formatDuration("2026-06-30", TODAY)).toBe("1 month");
  });
  it("formats years and months", () => {
    expect(formatDuration("2025-04-30", TODAY)).toBe("1 year 3 months");
    expect(formatDuration("2024-07-31", TODAY)).toBe("2 years");
  });
});

describe("computeMemberMetrics", () => {
  it("counts talk categories and totals", () => {
    const metrics = computeMemberMetrics({
      registerDate: "2026-01-01",
      updates: [
        update("2026-02-01", "idea_talk"),
        update("2026-03-01", "progress_talk"),
        update("2026-04-01", "progress_talk"),
      ],
      regularMeetupDates: [],
      today: TODAY,
    });
    expect(metrics.ideaTalkCount).toBe(1);
    expect(metrics.progressTalkCount).toBe(2);
    expect(metrics.totalUpdates).toBe(3);
  });

  it("measures durationActive from the earlier of registerDate and first talk", () => {
    // First talk predates registration (backfilled data).
    const metrics = computeMemberMetrics({
      registerDate: "2026-06-01",
      updates: [update("2025-07-31")],
      regularMeetupDates: [],
      today: TODAY,
    });
    expect(metrics.durationActive).toBe("1 year");
  });

  it("returns New for a fresh member", () => {
    const metrics = computeMemberMetrics({
      registerDate: "2026-07-20",
      updates: [],
      regularMeetupDates: [],
      today: TODAY,
    });
    expect(metrics.durationActive).toBe("New");
  });

  it("averages gaps between consecutive talks", () => {
    const metrics = computeMemberMetrics({
      registerDate: "2026-01-01",
      // Gaps: 30 days and 40 days -> avg 35.
      updates: [update("2026-01-10"), update("2026-02-09"), update("2026-03-21")],
      regularMeetupDates: [],
      today: TODAY,
    });
    expect(metrics.avgTimeBetweenTalks).toBe("~35 days");
  });

  it("returns null average with fewer than 2 updates", () => {
    const metrics = computeMemberMetrics({
      registerDate: "2026-01-01",
      updates: [update("2026-01-10")],
      regularMeetupDates: [],
      today: TODAY,
    });
    expect(metrics.avgTimeBetweenTalks).toBeNull();
  });

  it("counts regular meetups strictly after the last talk", () => {
    const metrics = computeMemberMetrics({
      registerDate: "2026-01-01",
      updates: [update("2026-03-01")],
      // On the talk date (excluded), after (2 counted), before (excluded).
      regularMeetupDates: ["2026-02-01", "2026-03-01", "2026-04-01", "2026-05-01"],
      today: TODAY,
    });
    expect(metrics.meetupsSinceLastTalk).toBe(2);
  });

  it("counts regular meetups since registerDate when the member never talked", () => {
    const metrics = computeMemberMetrics({
      registerDate: "2026-03-01",
      updates: [],
      regularMeetupDates: ["2026-02-01", "2026-03-01", "2026-04-01"],
      today: TODAY,
    });
    expect(metrics.meetupsSinceLastTalk).toBe(2);
  });

  it("excludes off_record_meetup from every metric", () => {
    const metrics = computeMemberMetrics({
      registerDate: "2026-01-01",
      updates: [
        update("2026-02-01", "progress_talk"),
        // Later off-record talk must not count as the "last talk" nor in totals.
        update("2026-06-01", "idea_talk", "off_record_meetup"),
      ],
      regularMeetupDates: ["2026-03-01", "2026-04-01"],
      today: TODAY,
    });
    expect(metrics.totalUpdates).toBe(1);
    expect(metrics.ideaTalkCount).toBe(0);
    expect(metrics.meetupsSinceLastTalk).toBe(2);
    expect(metrics.avgTimeBetweenTalks).toBeNull();
  });

  it("hackathon talks count as talks but not as regular meetups", () => {
    const metrics = computeMemberMetrics({
      registerDate: "2026-01-01",
      updates: [update("2026-02-01", "progress_talk", "hackathon")],
      regularMeetupDates: ["2026-03-01"],
      today: TODAY,
    });
    expect(metrics.totalUpdates).toBe(1);
    expect(metrics.meetupsSinceLastTalk).toBe(1);
  });
});
