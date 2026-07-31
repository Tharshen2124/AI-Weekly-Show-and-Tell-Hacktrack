"use client";

import { use, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMutation, useQuery } from "convex/react";
import { ArrowLeft, Pencil, Trash2 } from "lucide-react";
import { api } from "../../../../../convex/_generated/api";
import { Id } from "../../../../../convex/_generated/dataModel";
import { useAuthStore } from "@/lib/auth-store";
import { useToast } from "@/components/providers/toast-provider";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { MeetupFormModal } from "@/components/forms/meetup-form-modal";
import { UpdateAdminActions } from "@/components/cards/update-admin-actions";
import { ErrorState } from "@/components/ui/error-state";
import { MEETUP_CATEGORY_LABELS, UPDATE_CATEGORY_LABELS } from "@/lib/labels";
import { formatDate } from "@/lib/format";

export default function MeetupDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const toast = useToast();
  const token = useAuthStore((s) => s.token);
  const isAdmin = useAuthStore((s) => s.isAdmin);
  const meetup = useQuery(api.meetups.get, token ? { token, id: id as Id<"meetups"> } : "skip");
  const removeMeetup = useMutation(api.meetups.remove);
  const [editing, setEditing] = useState(false);
  const [confirmingDelete, setConfirmingDelete] = useState(false);

  if (meetup === null) {
    return <ErrorState message="This meetup does not exist (it may have been deleted)." />;
  }

  return (
    <div className="space-y-8">
      <Link
        href="/meetups"
        className="inline-flex items-center gap-1.5 text-sm text-ink-muted hover:text-ink"
      >
        <ArrowLeft className="h-4 w-4" />
        All meetups
      </Link>

      {meetup === undefined ? (
        <div className="space-y-4">
          <div className="h-10 w-64 animate-pulse rounded bg-surface-sunken" />
          <div className="h-32 animate-pulse rounded-card bg-surface-sunken" />
        </div>
      ) : (
        <>
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <h1 className="text-4xl">
                {MEETUP_CATEGORY_LABELS[meetup.category]} #{meetup.number}
              </h1>
              <p className="mt-2 text-sm text-ink-muted">
                {formatDate(meetup.date)} · Hosted by {meetup.hostName ?? "N/A"} ·{" "}
                {meetup.updateCount} {meetup.updateCount === 1 ? "update" : "updates"}
              </p>
            </div>
            {isAdmin && (
              <div className="flex gap-2">
                <button
                  onClick={() => setEditing(true)}
                  className="inline-flex items-center gap-1.5 rounded-card border border-edge px-3.5 py-2 text-sm transition-colors hover:bg-surface-sunken"
                >
                  <Pencil className="h-4 w-4" />
                  Edit
                </button>
                <button
                  onClick={() => setConfirmingDelete(true)}
                  className="inline-flex items-center gap-1.5 rounded-card border border-danger/40 px-3.5 py-2 text-sm text-danger transition-colors hover:bg-danger-soft"
                >
                  <Trash2 className="h-4 w-4" />
                  Delete
                </button>
              </div>
            )}
          </div>

          <section className="space-y-3">
            <h2 className="text-2xl">Updates</h2>
            {meetup.updates.length === 0 && (
              <p className="text-sm text-ink-faint">No updates were recorded at this meetup.</p>
            )}
            {meetup.updates.map((u) => (
              <div key={u._id} className="rounded-card border border-edge bg-surface-raised p-4">
                <div className="flex items-start justify-between gap-2">
                  <p className="text-sm font-medium">
                    <Link
                      href={`/members/${u.memberId}`}
                      className="underline-offset-4 hover:underline"
                    >
                      {u.memberName}
                    </Link>
                    <span className="text-ink-faint"> · </span>
                    <span className="text-ink-muted">{u.projectName}</span>
                  </p>
                  <span className="flex items-center gap-1">
                    <span className="rounded-full border border-edge px-2 py-0.5 text-[11px] whitespace-nowrap text-ink-muted">
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
          </section>

          <MeetupFormModal
            open={editing}
            onClose={() => setEditing(false)}
            initial={{
              id: meetup._id,
              number: meetup.number,
              date: meetup.date,
              category: meetup.category,
              hostId: meetup.hostId ?? null,
            }}
          />
          <ConfirmDialog
            open={confirmingDelete}
            onClose={() => setConfirmingDelete(false)}
            title="Delete meetup"
            description={`Deleting this meetup will also delete its ${meetup.updateCount} ${
              meetup.updateCount === 1 ? "update" : "updates"
            }. This cannot be undone.`}
            onConfirm={async () => {
              if (!token) return;
              try {
                await removeMeetup({ token, id: meetup._id });
                toast.success("Successfully deleted meetup!");
                router.push("/meetups");
              } catch {
                toast.error("Error occurred, meetup was not deleted.");
              }
            }}
          />
        </>
      )}
    </div>
  );
}
