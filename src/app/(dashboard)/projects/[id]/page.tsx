"use client";

import { use, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMutation, useQuery } from "convex/react";
import { ArrowLeft, CircleCheck, CircleDashed, Pencil, Trash2 } from "lucide-react";
import { api } from "../../../../../convex/_generated/api";
import { Id } from "../../../../../convex/_generated/dataModel";
import { useIsAdmin } from "@/lib/use-access";
import { useToast } from "@/components/providers/toast-provider";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { ProjectFormModal } from "@/components/forms/project-form-modal";
import { UpdateAdminActions } from "@/components/cards/update-admin-actions";
import { ErrorState } from "@/components/ui/error-state";
import { PROJECT_CATEGORY_LABELS } from "@/lib/labels";
import { formatDate } from "@/lib/format";

export default function ProjectDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const toast = useToast();
  const isAdmin = useIsAdmin();
  const project = useQuery(
    api.projects.get,
    { id: id as Id<"projects">  },
  );
  const removeProject = useMutation(api.projects.remove);
  const [editing, setEditing] = useState(false);
  const [confirmingDelete, setConfirmingDelete] = useState(false);

  if (project === null) {
    return <ErrorState message="This project does not exist (it may have been deleted)." />;
  }

  return (
    <div className="space-y-8">
      <Link
        href="/projects"
        className="inline-flex items-center gap-1.5 text-sm text-ink-muted hover:text-ink"
      >
        <ArrowLeft className="h-4 w-4" />
        All projects
      </Link>

      {project === undefined ? (
        <div className="space-y-4">
          <div className="h-10 w-64 animate-pulse rounded bg-surface-sunken" />
          <div className="h-32 animate-pulse rounded-card bg-surface-sunken" />
        </div>
      ) : (
        <>
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <div className="flex flex-wrap items-center gap-3">
                <h1 className="text-4xl">{project.name}</h1>
                <span
                  className={`inline-flex items-center gap-1.5 text-sm ${
                    project.completed ? "text-success" : "text-ink-faint"
                  }`}
                >
                  {project.completed ? (
                    <CircleCheck className="h-4 w-4" />
                  ) : (
                    <CircleDashed className="h-4 w-4" />
                  )}
                  {project.completed ? "Completed" : "Ongoing"}
                </span>
              </div>
              <p className="mt-2 text-sm text-ink-muted">
                {PROJECT_CATEGORY_LABELS[project.category]} · {project.updates.length}{" "}
                {project.updates.length === 1 ? "update" : "updates"}
              </p>
              <p className="mt-1 text-sm text-ink-faint">
                {project.members.length === 0
                  ? "No members"
                  : project.members.map((m, i) => (
                      <span key={m.id}>
                        {i > 0 && ", "}
                        <Link
                          href={`/members/${m.id}`}
                          className="underline-offset-4 hover:text-ink hover:underline"
                        >
                          {m.name}
                        </Link>
                      </span>
                    ))}
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
            {project.updates.length === 0 && (
              <p className="text-sm text-ink-faint">No talks recorded for this project yet.</p>
            )}
            {project.updates.map((u) => (
              <div key={u._id} className="rounded-card border border-edge bg-surface-raised p-4">
                <div className="flex items-start justify-between gap-2">
                  <p className="text-sm">
                    <Link
                      href={`/meetups/${u.meetupId}`}
                      className="font-medium underline-offset-4 hover:underline"
                    >
                      Meetup #{u.meetupNumber}
                    </Link>
                    <span className="text-ink-faint"> · {formatDate(u.meetupDate)} · by </span>
                    <Link
                      href={`/members/${u.memberId}`}
                      className="text-ink-muted underline-offset-4 hover:underline"
                    >
                      {u.memberName}
                    </Link>
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
                <p className="mt-1.5 text-sm text-ink-muted">{u.description}</p>
              </div>
            ))}
          </section>

          <ProjectFormModal
            open={editing}
            onClose={() => setEditing(false)}
            initial={{
              id: project._id,
              name: project.name,
              category: project.category,
              completed: project.completed,
              memberIds: project.members.map((m) => m.id),
            }}
          />
          <ConfirmDialog
            open={confirmingDelete}
            onClose={() => setConfirmingDelete(false)}
            title="Delete project"
            description={`Deleting "${project.name}" will also delete its ${project.updates.length} ${
              project.updates.length === 1 ? "update" : "updates"
            }. This cannot be undone.`}
            onConfirm={async () => {
              try {
                await removeProject({ id: project._id });
                toast.success("Successfully deleted project!");
                router.push("/projects");
              } catch {
                toast.error("Error occurred, project was not deleted.");
              }
            }}
          />
        </>
      )}
    </div>
  );
}
