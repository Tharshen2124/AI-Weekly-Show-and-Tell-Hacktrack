"use client";

import { useState } from "react";
import Link from "next/link";
import { useMutation, useQuery } from "convex/react";
import { FunctionReturnType } from "convex/server";
import {
  CalendarClock,
  Folder,
  Hourglass,
  MessageSquareText,
  Pencil,
  Timer,
  Trash2,
} from "lucide-react";
import { api } from "../../../convex/_generated/api";
import { Id } from "../../../convex/_generated/dataModel";
import { useIsAdmin } from "@/lib/use-access";
import { useToast } from "@/components/providers/toast-provider";
import { ModalLayout } from "@/components/ui/modal-layout";
import { StatusPill } from "@/components/ui/status-pill";
import { NullTextIndicator } from "@/components/ui/null-text-indicator";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { ProjectFormModal } from "@/components/forms/project-form-modal";
import { MemberForm } from "@/components/forms/member-form";
import { UpdateAdminActions } from "./update-admin-actions";
import { PROJECT_CATEGORY_LABELS } from "@/lib/labels";
import { formatDate } from "@/lib/format";

export type MemberListItem = FunctionReturnType<typeof api.functions.members.list>["data"][number];
type MemberDetail = NonNullable<FunctionReturnType<typeof api.functions.members.get>>;
type MemberProject = MemberDetail["projects"][number];

function Metric({
  icon: Icon,
  label,
  value,
}: {
  icon: typeof Folder;
  label: string;
  value: React.ReactNode;
}) {
  return (
    <div className="flex items-center justify-between gap-2 text-sm">
      <span className="flex items-center gap-1.5 text-ink-muted">
        <Icon className="h-3.5 w-3.5 text-ink-faint" />
        {label}
      </span>
      <span className="font-medium tabular-nums">{value}</span>
    </div>
  );
}

export function MemberCard({ member }: { member: MemberListItem }) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="group w-full rounded-card border border-edge bg-surface-raised p-4 text-left transition-all hover:-translate-y-0.5 hover:shadow-md"
      >
        <div className="flex items-start justify-between gap-2">
          <h3 className="font-serif-display text-xl leading-tight">{member.name}</h3>
          <StatusPill isActive={member.isActive} />
        </div>
        <div className="mt-4 space-y-2">
          <Metric icon={Folder} label="Projects" value={member.projectCount} />
          <Metric icon={MessageSquareText} label="Updates" value={member.totalUpdates} />
          <Metric icon={Hourglass} label="Active for" value={member.durationActive} />
          <Metric
            icon={Timer}
            label="Avg between talks"
            value={member.avgTimeBetweenTalks ?? <NullTextIndicator />}
          />
          <Metric
            icon={CalendarClock}
            label="Meetups since last talk"
            value={member.meetupsSinceLastTalk}
          />
        </div>
      </button>
      {open && <MemberDetailModal memberId={member._id} onClose={() => setOpen(false)} />}
    </>
  );
}

function ProjectSection({ project }: { project: MemberProject }) {
  const isAdmin = useIsAdmin();
  const toast = useToast();
  const removeProject = useMutation(api.functions.projects.remove);
  const [editing, setEditing] = useState(false);
  const [confirming, setConfirming] = useState(false);

  return (
    <div className="rounded-card border border-edge bg-surface p-3.5">
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="font-medium">{project.name}</p>
          <p className="text-xs text-ink-faint">
            {PROJECT_CATEGORY_LABELS[project.category]}
            {project.completed ? " · Completed" : ""}
            {" · "}
            {project.members.map((m) => m.name).join(", ")}
          </p>
        </div>
        {isAdmin && (
          <span className="flex shrink-0 items-center gap-1">
            <button
              aria-label="Edit project"
              onClick={() => setEditing(true)}
              className="rounded p-1.5 text-ink-faint transition-colors hover:bg-surface-sunken hover:text-ink"
            >
              <Pencil className="h-3.5 w-3.5" />
            </button>
            <button
              aria-label="Delete project"
              onClick={() => setConfirming(true)}
              className="rounded p-1.5 text-ink-faint transition-colors hover:bg-danger-soft hover:text-danger"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          </span>
        )}
      </div>

      {project.updates.length > 0 && (
        <ul className="mt-3 space-y-2 border-t border-edge pt-3">
          {project.updates.map((u) => (
            <li key={u._id} className="text-sm">
              <div className="flex items-start justify-between gap-2">
                <span className="text-ink-muted">
                  <span className="font-medium text-ink">Meetup #{u.meetupNumber}</span> ·{" "}
                  {formatDate(u.meetupDate)} · by {u.memberName}
                </span>
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
              <p className="text-ink-muted">{u.description}</p>
            </li>
          ))}
        </ul>
      )}

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
        open={confirming}
        onClose={() => setConfirming(false)}
        title="Delete project"
        description={`Deleting "${project.name}" will also delete its ${project.updates.length} ${
          project.updates.length === 1 ? "update" : "updates"
        }. This cannot be undone.`}
        onConfirm={async () => {
          try {
            await removeProject({ id: project._id });
            toast.success("Successfully deleted project!");
          } catch {
            toast.error("Error occurred, project was not deleted.");
          }
        }}
      />
    </div>
  );
}

export function MemberDetailModal({
  memberId,
  onClose,
}: {
  memberId: Id<"members">;
  onClose: () => void;
}) {
  const isAdmin = useIsAdmin();
  const toast = useToast();
  const member = useQuery(api.functions.members.get, { id: memberId  });
  const removeMember = useMutation(api.functions.members.remove);
  const [editing, setEditing] = useState(false);
  const [confirming, setConfirming] = useState(false);

  return (
    <ModalLayout
      open
      onClose={onClose}
      title={member?.name ?? "Member"}
      wide
      footer={
        member && (
          <Link
            href={`/members/${member._id}`}
            className="text-sm font-medium underline underline-offset-4 hover:text-ink-muted"
          >
            View full page →
          </Link>
        )
      }
      headerActions={
        isAdmin &&
        member && (
          <>
            <button
              aria-label="Edit member"
              onClick={() => setEditing(true)}
              className="rounded-card p-1.5 text-ink-muted transition-colors hover:bg-surface-sunken hover:text-ink"
            >
              <Pencil className="h-4 w-4" />
            </button>
            <button
              aria-label="Delete member"
              onClick={() => setConfirming(true)}
              className="rounded-card p-1.5 text-ink-muted transition-colors hover:bg-danger-soft hover:text-danger"
            >
              <Trash2 className="h-4 w-4" />
            </button>
          </>
        )
      }
    >
      {!member ? (
        <div className="space-y-3 py-2">
          <div className="h-5 w-40 animate-pulse rounded bg-surface-sunken" />
          <div className="h-24 animate-pulse rounded bg-surface-sunken" />
        </div>
      ) : (
        <>
          <div className="flex flex-wrap items-center gap-2">
            <StatusPill isActive={member.isActive} />
            <span className="text-sm text-ink-muted">
              Active for {member.durationActive} · {member.totalUpdates} updates ·{" "}
              {member.meetupsSinceLastTalk} meetups since last talk
            </span>
          </div>
          <div className="mt-5 space-y-3">
            <h3 className="text-sm font-medium tracking-wider text-ink-faint uppercase">
              Projects
            </h3>
            {member.projects.length === 0 && (
              <p className="py-4 text-center text-sm text-ink-faint">No projects yet.</p>
            )}
            {member.projects.map((project) => (
              <ProjectSection key={project._id} project={project} />
            ))}
          </div>

          <ModalLayout
            open={editing}
            onClose={() => setEditing(false)}
            title="Edit Member"
            wide
          >
            {/* Mounted only while open, so state resets every time the modal reopens. */}
            {editing && (
              <MemberForm
                initial={{
                  id: member._id,
                  name: member.name,
                  email: member.email,
                  isActive: member.isActive,
                  registerDate: member.registerDate,
                  accessLevel: member.accessLevel ?? "none",
                }}
                onSaved={() => setEditing(false)}
                onCancel={() => setEditing(false)}
              />
            )}
          </ModalLayout>
          <ConfirmDialog
            open={confirming}
            onClose={() => setConfirming(false)}
            title="Delete member"
            description={`Deleting ${member.name} will also delete their ${member.totalUpdates} ${
              member.totalUpdates === 1 ? "update" : "updates"
            }, remove them from their projects, and delete any project left with no members. This cannot be undone.`}
            onConfirm={async () => {
              try {
                await removeMember({ id: member._id });
                toast.success("Successfully deleted member!");
                onClose();
              } catch {
                toast.error("Error occurred, member was not deleted.");
              }
            }}
          />
        </>
      )}
    </ModalLayout>
  );
}
