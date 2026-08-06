"use client";

import { use, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMutation, useQuery } from "convex/react";
import { ArrowLeft, Pencil, Trash2 } from "lucide-react";
import { api } from "../../../../../convex/_generated/api";
import { Id } from "../../../../../convex/_generated/dataModel";
import { useIsAdmin } from "@/lib/use-access";
import { useToast } from "@/components/providers/toast-provider";
import { StatusPill } from "@/components/ui/status-pill";
import { NullTextIndicator } from "@/components/ui/null-text-indicator";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { UpdateAdminActions } from "@/components/cards/update-admin-actions";
import { ErrorState } from "@/components/ui/error-state";
import { PROJECT_CATEGORY_LABELS } from "@/lib/labels";
import { formatDate } from "@/lib/format";

export default function MemberDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const toast = useToast();
  const isAdmin = useIsAdmin();
  const member = useQuery(
    api.members.get,
    { id: id as Id<"members">  },
  );
  const removeMember = useMutation(api.members.remove);
  const [confirmingDelete, setConfirmingDelete] = useState(false);

  if (member === null) {
    return <ErrorState message="This member does not exist (they may have been deleted)." />;
  }

  return (
    <div className="space-y-8">
      <Link
        href="/members"
        className="inline-flex items-center gap-1.5 text-sm text-ink-muted hover:text-ink"
      >
        <ArrowLeft className="h-4 w-4" />
        All members
      </Link>

      {member === undefined ? (
        <div className="space-y-4">
          <div className="h-10 w-64 animate-pulse rounded bg-surface-sunken" />
          <div className="h-32 animate-pulse rounded-card bg-surface-sunken" />
        </div>
      ) : (
        <>
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <div className="flex flex-wrap items-center gap-3">
                <h1 className="text-4xl">{member.name}</h1>
                <StatusPill isActive={member.isActive} />
              </div>
              <p className="mt-2 text-sm text-ink-muted">{member.email}</p>
              <p className="mt-1 text-sm text-ink-faint">
                Registered {formatDate(member.registerDate)}
              </p>
            </div>
            {isAdmin && (
              <div className="flex gap-2">
                <Link
                  href={`/members/${member._id}/edit`}
                  className="inline-flex items-center gap-1.5 rounded-card border border-edge px-3.5 py-2 text-sm transition-colors hover:bg-surface-sunken"
                >
                  <Pencil className="h-4 w-4" />
                  Edit
                </Link>
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

          {/* Metrics */}
          <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
            {[
              { label: "Projects", value: member.projectCount },
              { label: "Progress talks", value: member.progressTalkNum },
              { label: "Updates", value: member.totalUpdates },
              { label: "Active for", value: member.durationActive },
              {
                label: "Avg between talks",
                value: member.avgTimeBetweenTalks ?? <NullTextIndicator />,
              },
              { label: "Meetups since last talk", value: member.meetupsSinceLastTalk },
            ].map((metric) => (
              <div key={metric.label} className="rounded-card border border-edge bg-surface-raised p-4">
                <p className="text-xs text-ink-muted">{metric.label}</p>
                <p className="font-serif-display mt-1 text-2xl">{metric.value}</p>
              </div>
            ))}
          </div>

          {/* Projects with update history */}
          <section className="space-y-4">
            <h2 className="text-2xl">Projects</h2>
            {member.projects.length === 0 && (
              <p className="text-sm text-ink-faint">No projects yet.</p>
            )}
            {member.projects.map((project) => (
              <div key={project._id} className="rounded-card border border-edge bg-surface-raised p-5">
                <div className="flex flex-wrap items-baseline gap-2">
                  <h3 className="font-serif-display text-xl">{project.name}</h3>
                  <span className="text-xs text-ink-faint">
                    {PROJECT_CATEGORY_LABELS[project.category]}
                    {project.completed ? " · Completed" : ""} ·{" "}
                    {project.members.map((m) => m.name).join(", ")}
                  </span>
                </div>
                {project.updates.length === 0 ? (
                  <p className="mt-3 text-sm text-ink-faint">No talks recorded for this project.</p>
                ) : (
                  <ul className="mt-4 space-y-3 border-t border-edge pt-4">
                    {project.updates.map((u) => (
                      <li key={u._id} className="text-sm">
                        <div className="flex items-start justify-between gap-2">
                          <p>
                            <Link
                              href={`/meetups/${u.meetupId}`}
                              className="font-medium underline-offset-4 hover:underline"
                            >
                              Meetup #{u.meetupNumber}
                            </Link>
                            <span className="text-ink-faint">
                              {" "}
                              · {formatDate(u.meetupDate)} · by {u.memberName}
                            </span>
                          </p>
                          {isAdmin && (
                            <UpdateAdminActions
                              update={{
                                id: u._id,
                                memberId: u.memberId,
                                projectId: project._id,
                                meetupId: u.meetupId,
                                description: u.description,
                              }}
                            />
                          )}
                        </div>
                        <p className="mt-0.5 text-ink-muted">{u.description}</p>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            ))}
          </section>

          <ConfirmDialog
            open={confirmingDelete}
            onClose={() => setConfirmingDelete(false)}
            title="Delete member"
            description={`Deleting ${member.name} will also delete their ${member.totalUpdates} ${
              member.totalUpdates === 1 ? "update" : "updates"
            }. This cannot be undone.`}
            onConfirm={async () => {
              try {
                await removeMember({ id: member._id });
                toast.success("Successfully deleted member!");
                router.push("/members");
              } catch {
                toast.error("Error occurred, member was not deleted.");
              }
            }}
          />
        </>
      )}
    </div>
  );
}
