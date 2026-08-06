"use client";

import Link from "next/link";
import { useQuery } from "convex/react";
import { api } from "../../../../convex/_generated/api";
import { AdminControlPanel } from "@/components/forms/admin-control-panel";
import { MemberCard } from "@/components/cards/member-card";
import { MeetupCard } from "@/components/cards/meetup-card";
import { CardGridSkeleton, StatSkeleton } from "@/components/ui/skeletons";
import { EmptyState } from "@/components/ui/error-state";

function Section({
  title,
  viewAllHref,
  children,
}: {
  title: string;
  viewAllHref: string;
  children: React.ReactNode;
}) {
  return (
    <section>
      <div className="mb-4 flex items-baseline justify-between">
        <h2 className="text-2xl">{title}</h2>
        <Link
          href={viewAllHref}
          className="text-sm font-medium text-ink-muted underline underline-offset-4 hover:text-ink"
        >
          View All
        </Link>
      </div>
      {children}
    </section>
  );
}

export default function DashboardPage() {
  const summary = useQuery(api.dashboard.summary, {});

  const stats = summary
    ? [
        { label: "Members", value: summary.stats.memberCount },
        { label: "Meetups", value: summary.stats.meetupCount },
        { label: "Projects", value: summary.stats.projectCount },
        { label: "Updates", value: summary.stats.updateCount },
      ]
    : null;

  return (
    <div className="space-y-10">
      <div>
        <h1 className="text-4xl">Dashboard</h1>
        <p className="mt-1.5 text-sm text-ink-muted">
          The community at a glance — meetups, projects, and who&apos;s been talking.
        </p>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        {stats
          ? stats.map((stat) => (
              <div key={stat.label} className="rounded-card border border-edge bg-surface-raised p-4">
                <p className="text-sm text-ink-muted">{stat.label}</p>
                <p className="font-serif-display mt-1 text-3xl tabular-nums">{stat.value}</p>
              </div>
            ))
          : Array.from({ length: 4 }).map((_, i) => <StatSkeleton key={i} />)}
      </div>

      <AdminControlPanel />

      <Section title="Meetups" viewAllHref="/meetups">
        {!summary ? (
          <CardGridSkeleton count={4} kind="meetup" />
        ) : summary.recentMeetups.length === 0 ? (
          <EmptyState message="No meetups recorded yet." />
        ) : (
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
            {summary.recentMeetups.map((meetup) => (
              <MeetupCard key={meetup._id} meetup={meetup} />
            ))}
          </div>
        )}
      </Section>

      <Section title="Active Members" viewAllHref="/members">
        {!summary ? (
          <CardGridSkeleton count={4} kind="member" />
        ) : summary.activeMembers.length === 0 ? (
          <EmptyState message="No active members yet." />
        ) : (
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
            {summary.activeMembers.map((member) => (
              <MemberCard key={member._id} member={member} />
            ))}
          </div>
        )}
      </Section>
    </div>
  );
}
