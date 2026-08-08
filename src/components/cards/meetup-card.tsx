"use client";

import { useState } from "react";
import Link from "next/link";
import { useMutation } from "convex/react";
import { CalendarDays, MessageSquareText, Pencil, Trash2 } from "lucide-react";
import { FunctionReturnType } from "convex/server";
import { api } from "../../../convex/_generated/api";
import { formatDate } from "@/lib/format";
import { useIsAdmin } from "@/lib/use-access";
import { useToast } from "@/components/providers/toast-provider";
import { ModalLayout } from "@/components/ui/modal-layout";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { MeetupFormModal } from "@/components/forms/meetup-form-modal";
import { UpdateAdminActions } from "./update-admin-actions";

export type MeetupListItem = FunctionReturnType<typeof api.functions.meetups.list>["meetups"][number];

export function MeetupCard({ meetup }: { meetup: MeetupListItem }) {
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const isAdmin = useIsAdmin();
  const toast = useToast();
  const removeMeetup = useMutation(api.functions.meetups.remove);
  const title = `Meetup #${meetup.number}`;

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="group w-full rounded-card border border-edge bg-surface-raised p-4 text-left transition-all hover:-translate-y-0.5 hover:shadow-md"
      >
        <div className="flex items-baseline justify-between gap-2">
          <h3 className="font-serif-display text-xl">{title}</h3>
        </div>
        <dl className="mt-3 space-y-1.5 text-sm text-ink-muted">
          <div className="flex items-center gap-2">
            <CalendarDays className="h-4 w-4 text-ink-faint" />
            {formatDate(meetup.date)}
          </div>
          <div className="flex items-center gap-2">
            <MessageSquareText className="h-4 w-4 text-ink-faint" />
            {meetup.updateCount} {meetup.updateCount === 1 ? "update" : "updates"}
          </div>
        </dl>
      </button>

      <ModalLayout
        open={open}
        onClose={() => setOpen(false)}
        title={title}
        wide
        headerActions={
          isAdmin && (
            <>
              <button
                aria-label="Edit meetup"
                onClick={() => setEditing(true)}
                className="rounded-card p-1.5 text-ink-muted transition-colors hover:bg-surface-sunken hover:text-ink"
              >
                <Pencil className="h-4 w-4" />
              </button>
              <button
                aria-label="Delete meetup"
                onClick={() => setConfirming(true)}
                className="rounded-card p-1.5 text-ink-muted transition-colors hover:bg-danger-soft hover:text-danger"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </>
          )
        }
      >
        <p className="text-sm text-ink-muted">{formatDate(meetup.date)}</p>
        <div className="mt-4 space-y-3">
          {meetup.updates.length === 0 && (
            <p className="py-6 text-center text-sm text-ink-faint">
              No updates were recorded at this meetup.
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
                {isAdmin && (
                  <UpdateAdminActions
                    update={{
                      id: u._id,
                      memberId: u.memberId,
                      projectId: u.projectId,
                      meetupId: meetup._id,
                      description: u.description,
                    }}
                  />
                )}
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

      <MeetupFormModal
        open={editing}
        onClose={() => setEditing(false)}
        initial={{ id: meetup._id, number: meetup.number, date: meetup.date }}
      />
      <ConfirmDialog
        open={confirming}
        onClose={() => setConfirming(false)}
        title="Delete meetup"
        description={`Deleting ${title} will also delete its ${meetup.updateCount} ${
          meetup.updateCount === 1 ? "update" : "updates"
        }. This cannot be undone.`}
        onConfirm={async () => {
          try {
            await removeMeetup({ id: meetup._id });
            toast.success("Successfully deleted meetup!");
            setOpen(false);
          } catch {
            toast.error("Error occurred, meetup was not deleted.");
          }
        }}
      />
    </>
  );
}
