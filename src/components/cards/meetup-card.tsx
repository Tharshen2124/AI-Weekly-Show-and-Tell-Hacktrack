"use client";

import { useState } from "react";
import Link from "next/link";
import { CalendarDays, MessageSquareText, User } from "lucide-react";
import { FunctionReturnType } from "convex/server";
import { api } from "../../../convex/_generated/api";
import { formatDate } from "@/lib/format";
import { useAuthStore } from "@/lib/auth-store";
import { ModalLayout } from "@/components/ui/modal-layout";
import { NullTextIndicator } from "@/components/ui/null-text-indicator";
import { UPDATE_CATEGORY_LABELS } from "@/lib/labels";
import { UpdateAdminActions } from "./update-admin-actions";

export type MeetupListItem = FunctionReturnType<typeof api.meetups.list>["regularMeetups"][number];

interface MeetupCardProps {
  meetup: MeetupListItem;
  variant?: "regular" | "hackathon";
}

export function MeetupCard({ meetup, variant = "regular" }: MeetupCardProps) {
  const [open, setOpen] = useState(false);
  const isAdmin = useAuthStore((s) => s.isAdmin);
  const hackathon = variant === "hackathon";
  const title = hackathon ? `Hackathon #${meetup.number}` : `Meetup #${meetup.number}`;

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className={`group w-full rounded-card border p-4 text-left transition-all hover:-translate-y-0.5 hover:shadow-md ${
          hackathon
            ? "border-edge-strong bg-surface-sunken"
            : "border-edge bg-surface-raised"
        }`}
      >
        <div className="flex items-baseline justify-between gap-2">
          <h3 className="font-serif-display text-xl">{title}</h3>
          {hackathon && (
            <span className="rounded-full border border-edge-strong px-2 py-0.5 text-[11px] font-medium tracking-wider text-ink-muted uppercase">
              Hack
            </span>
          )}
        </div>
        <dl className="mt-3 space-y-1.5 text-sm text-ink-muted">
          <div className="flex items-center gap-2">
            <CalendarDays className="h-4 w-4 text-ink-faint" />
            {formatDate(meetup.date)}
          </div>
          <div className="flex items-center gap-2">
            <User className="h-4 w-4 text-ink-faint" />
            {meetup.hostName ?? <NullTextIndicator />}
          </div>
          <div className="flex items-center gap-2">
            <MessageSquareText className="h-4 w-4 text-ink-faint" />
            {meetup.updateCount} {meetup.updateCount === 1 ? "update" : "updates"}
          </div>
        </dl>
      </button>

      <ModalLayout open={open} onClose={() => setOpen(false)} title={title} wide>
        <p className="text-sm text-ink-muted">
          {formatDate(meetup.date)} · Hosted by {meetup.hostName ?? "N/A"}
        </p>
        <div className="mt-4 space-y-3">
          {meetup.updates.length === 0 && (
            <p className="py-6 text-center text-sm text-ink-faint">
              No updates were recorded at this {hackathon ? "hackathon" : "meetup"}.
            </p>
          )}
          {meetup.updates.map((u) => (
            <div key={u._id} className="rounded-card border border-edge bg-surface p-3">
              <div className="flex items-start justify-between gap-2">
                <p className="text-sm font-medium">
                  {u.memberName}
                  <span className="text-ink-faint"> · </span>
                  <span className="text-ink-muted">{u.projectName}</span>
                </p>
                <span className="flex items-center gap-1">
                  <span className="rounded-full border border-edge px-2 py-0.5 text-[11px] text-ink-muted whitespace-nowrap">
                    {UPDATE_CATEGORY_LABELS[u.category]}
                  </span>
                  {isAdmin && (
                    <UpdateAdminActions
                      update={{
                        id: u._id,
                        memberId: u.memberId,
                        projectId: u.projectId,
                        meetupId: meetup._id,
                        category: u.category,
                        description: u.description,
                      }}
                    />
                  )}
                </span>
              </div>
              <p className="mt-1.5 text-sm text-ink-muted">{u.description}</p>
            </div>
          ))}
        </div>
        <div className="mt-5 border-t border-edge pt-4">
          <Link
            href={`/meetups/${meetup._id}`}
            className="text-sm font-medium underline underline-offset-4 hover:text-ink-muted"
          >
            View full page →
          </Link>
        </div>
      </ModalLayout>
    </>
  );
}
