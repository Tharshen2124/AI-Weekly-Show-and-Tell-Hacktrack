"use client";

import { useState } from "react";
import { useQuery } from "convex/react";
import { api } from "../../../../convex/_generated/api";
import { useAuthStore } from "@/lib/auth-store";
import { MeetupCard } from "@/components/cards/meetup-card";
import { Pagination } from "@/components/ui/pagination";
import { CardGridSkeleton } from "@/components/ui/skeletons";
import { EmptyState } from "@/components/ui/error-state";

export default function MeetupsPage() {
  const token = useAuthStore((s) => s.token);
  const [page, setPage] = useState(1);
  const list = useQuery(api.meetups.list, token ? { token, page } : "skip");

  return (
    <div className="space-y-10">
      <div>
        <h1 className="text-4xl">Meetups</h1>
        <p className="mt-1.5 text-sm text-ink-muted">
          Every recorded meetup and hackathon, newest first.
        </p>
      </div>

      <section>
        <h2 className="mb-4 text-2xl">Regular Meetups</h2>
        {!list ? (
          <CardGridSkeleton count={8} kind="meetup" />
        ) : list.regularMeetups.length === 0 ? (
          <EmptyState message="No regular meetups on this page." />
        ) : (
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
            {list.regularMeetups.map((meetup) => (
              <MeetupCard key={meetup._id} meetup={meetup} />
            ))}
          </div>
        )}
      </section>

      <section>
        <h2 className="mb-4 text-2xl">Hackathons</h2>
        {!list ? (
          <CardGridSkeleton count={4} kind="meetup" />
        ) : list.hackathons.length === 0 ? (
          <EmptyState message="No hackathons on this page." />
        ) : (
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
            {list.hackathons.map((meetup) => (
              <MeetupCard key={meetup._id} meetup={meetup} variant="hackathon" />
            ))}
          </div>
        )}
      </section>

      {list && list.totalPages > 1 && (
        <div className="flex justify-center">
          <Pagination page={page} totalPages={list.totalPages} onPageChange={setPage} />
        </div>
      )}
    </div>
  );
}
