"use client";

import { useState } from "react";
import { useQuery } from "convex/react";
import { CalendarDays, X } from "lucide-react";
import { api } from "../../../../convex/_generated/api";
import { formatDate } from "@/lib/format";
import { MeetupCard } from "@/components/cards/meetup-card";
import { Pagination } from "@/components/ui/pagination";
import { CardGridSkeleton } from "@/components/ui/skeletons";
import { EmptyState } from "@/components/ui/error-state";

const DATE_INPUT =
  "rounded-card border border-edge bg-surface-raised px-3 py-2 text-sm outline-none transition-colors focus:border-edge-strong dark:[color-scheme:dark]";

/** Says which end of the range came up empty, rather than just "nothing found". */
function emptyMessage(from: string, to: string): string {
  if (from && to) return `No meetups between ${formatDate(from)} and ${formatDate(to)}.`;
  if (from) return `No meetups on or after ${formatDate(from)}.`;
  if (to) return `No meetups on or before ${formatDate(to)}.`;
  return "No meetups yet.";
}

export default function MeetupsPage() {
  const [page, setPage] = useState(1);
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const list = useQuery(api.functions.meetups.list, { from, to, page });

  // A date field only ever emits a whole date or "", so unlike the name searches
  // elsewhere there is nothing here worth debouncing.
  const setRange = (nextFrom: string, nextTo: string) => {
    setFrom(nextFrom);
    setTo(nextTo);
    setPage(1);
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-4xl">Meetups</h1>
        <p className="mt-1.5 text-sm text-ink-muted">Every recorded meetup, newest first.</p>
      </div>

      {/* Date range — either end can be left open, so a rough guess still narrows. */}
      <div className="flex flex-wrap items-center gap-2">
        <CalendarDays className="h-4 w-4 text-ink-faint" />
        <input
          type="date"
          aria-label="From date"
          value={from}
          max={to || undefined}
          onChange={(e) => setRange(e.target.value, to)}
          className={DATE_INPUT}
        />
        <span className="text-sm text-ink-faint">to</span>
        <input
          type="date"
          aria-label="To date"
          value={to}
          min={from || undefined}
          onChange={(e) => setRange(from, e.target.value)}
          className={DATE_INPUT}
        />
        {(from || to) && (
          <button
            onClick={() => setRange("", "")}
            className="inline-flex items-center gap-1 rounded-card px-2 py-2 text-sm text-ink-faint transition-colors hover:bg-surface-sunken hover:text-ink"
          >
            <X className="h-4 w-4" />
            Clear
          </button>
        )}
      </div>

      <section>
        {!list ? (
          <CardGridSkeleton count={8} kind="meetup" />
        ) : list.meetups.length === 0 ? (
          <EmptyState message={emptyMessage(from, to)} />
        ) : (
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
            {list.meetups.map((meetup) => (
              <MeetupCard key={meetup._id} meetup={meetup} />
            ))}
          </div>
        )}
      </section>

      {list && <Pagination page={page} totalPages={list.totalPages} onPageChange={setPage} />}
    </div>
  );
}
