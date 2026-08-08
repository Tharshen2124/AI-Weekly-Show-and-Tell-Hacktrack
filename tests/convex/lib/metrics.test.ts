import { describe, expect, it } from "vitest";
import { computeMemberMetrics, daysBetween, formatDuration } from "../../../convex/lib/metrics";

const TODAY = "2026-07-31";

function update(meetupDate: string) {
  return { meetupDate };
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
  it("counts total updates", () => {
    const metrics = computeMemberMetrics({
      registerDate: "2026-01-01",
      updates: [update("2026-02-01"), update("2026-03-01"), update("2026-04-01")],
      meetupDates: [],
      today: TODAY,
    });
    expect(metrics.totalUpdates).toBe(3);
  });

  it("measures durationActive from the earlier of registerDate and first talk", () => {
    // First talk predates registration (backfilled data).
    const metrics = computeMemberMetrics({
      registerDate: "2026-06-01",
      updates: [update("2025-07-31")],
      meetupDates: [],
      today: TODAY,
    });
    expect(metrics.durationActive).toBe("1 year");
  });

  it("returns New for a fresh member", () => {
    const metrics = computeMemberMetrics({
      registerDate: "2026-07-20",
      updates: [],
      meetupDates: [],
      today: TODAY,
    });
    expect(metrics.durationActive).toBe("New");
  });

  it("averages gaps between consecutive talks", () => {
    const metrics = computeMemberMetrics({
      registerDate: "2026-01-01",
      // Gaps: 30 days and 40 days -> avg 35.
      updates: [update("2026-01-10"), update("2026-02-09"), update("2026-03-21")],
      meetupDates: [],
      today: TODAY,
    });
    expect(metrics.avgTimeBetweenTalks).toBe("~35 days");
  });

  it("returns null average with fewer than 2 updates", () => {
    const metrics = computeMemberMetrics({
      registerDate: "2026-01-01",
      updates: [update("2026-01-10")],
      meetupDates: [],
      today: TODAY,
    });
    expect(metrics.avgTimeBetweenTalks).toBeNull();
  });

  it("counts meetups strictly after the last talk", () => {
    const metrics = computeMemberMetrics({
      registerDate: "2026-01-01",
      updates: [update("2026-03-01")],
      // On the talk date (excluded), after (2 counted), before (excluded).
      meetupDates: ["2026-02-01", "2026-03-01", "2026-04-01", "2026-05-01"],
      today: TODAY,
    });
    expect(metrics.meetupsSinceLastTalk).toBe(2);
  });

  it("counts meetups since registerDate when the member never talked", () => {
    const metrics = computeMemberMetrics({
      registerDate: "2026-03-01",
      updates: [],
      meetupDates: ["2026-02-01", "2026-03-01", "2026-04-01"],
      today: TODAY,
    });
    expect(metrics.meetupsSinceLastTalk).toBe(2);
  });
});
