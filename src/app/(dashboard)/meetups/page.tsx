"use client";

import { useState } from "react";
import { useQuery } from "convex/react";
import { api } from "../../../../convex/_generated/api";
import { MeetupCard } from "@/components/cards/meetup-card";
import { Pagination } from "@/components/ui/pagination";
import { CardGridSkeleton } from "@/components/ui/skeletons";
import { EmptyState } from "@/components/ui/error-state";

export default function MeetupsPage() {
  const [page, setPage] = useState(1);
  const list = useQuery(api.functions.meetups.list, { page  });

  return (
    <div className="space-y-10">
      <div>
        <h1 className="text-4xl">Meetups</h1>
        <p className="mt-1.5 text-sm text-ink-muted">Every recorded meetup, newest first.</p>
      </div>

      <section>
        {!list ? (
          <CardGridSkeleton count={8} kind="meetup" />
        ) : list.meetups.length === 0 ? (
          <EmptyState message="No meetups on this page." />
        ) : (
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
            {list.meetups.map((meetup) => (
              <MeetupCard key={meetup._id} meetup={meetup} />
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
