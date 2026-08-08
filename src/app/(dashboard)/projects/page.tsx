"use client";

import { useState } from "react";
import Link from "next/link";
import { useMutation, useQuery } from "convex/react";
import { FunctionReturnType } from "convex/server";
import { CircleCheck, CircleDashed, FolderPlus, Pencil, Search, Trash2, X } from "lucide-react";
import { api } from "../../../../convex/_generated/api";
import { useIsAdmin } from "@/lib/use-access";
import { useToast } from "@/components/providers/toast-provider";
import { ProjectFormModal } from "@/components/forms/project-form-modal";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { ProjectRowSkeleton } from "@/components/ui/skeletons";
import { EmptyState } from "@/components/ui/error-state";
import { PROJECT_CATEGORY_LABELS } from "@/lib/labels";

type ProjectItem = FunctionReturnType<typeof api.projects.list>[number];

/** Names shown inline in the table; the rest collapse into a "+N more" hint. */
const VISIBLE_MEMBERS = 2;

/**
 * The header and every row are separate grids, so they only line up while they
 * share this template — including a fixed last column, since an `auto` one
 * resolves differently for admins (two buttons) and members (nothing).
 */
const GRID_COLS =
  "sm:grid-cols-[minmax(0,1fr)_8rem_minmax(0,1fr)_6rem_7rem_4rem]";

function ProjectRow({ project }: { project: ProjectItem }) {
  const isAdmin = useIsAdmin();
  const toast = useToast();
  const removeProject = useMutation(api.projects.remove);
  const [editing, setEditing] = useState(false);
  const [confirming, setConfirming] = useState(false);

  return (
    <div
      className={`grid grid-cols-1 gap-2 border-b border-edge px-4 py-3.5 last:border-b-0 sm:items-center sm:gap-4 ${GRID_COLS}`}
    >
      <Link
        href={`/projects/${project._id}`}
        title={project.name}
        className="min-w-0 truncate font-medium underline-offset-4 hover:underline"
      >
        {project.name}
      </Link>
      <span className="text-sm text-ink-muted">{PROJECT_CATEGORY_LABELS[project.category]}</span>
      {/* Only the first few names fit a row; the rest are on the project page. */}
      <span
        className="min-w-0 truncate text-sm text-ink-muted"
        title={project.members.map((m) => m.name).join(", ")}
      >
        {project.members.length === 0
          ? "—"
          : project.members.slice(0, VISIBLE_MEMBERS).map((m, i) => (
              <span key={m.id}>
                {i > 0 && ", "}
                <Link href={`/members/${m.id}`} className="underline-offset-4 hover:underline">
                  {m.name}
                </Link>
              </span>
            ))}
        {project.members.length > VISIBLE_MEMBERS && (
          <span className="text-ink-faint">
            {" "}
            +{project.members.length - VISIBLE_MEMBERS} more
          </span>
        )}
      </span>
      <span className="text-sm whitespace-nowrap text-ink-muted tabular-nums">
        {project.updateCount} {project.updateCount === 1 ? "update" : "updates"}
      </span>
      <span
        className={`inline-flex items-center gap-1.5 text-sm whitespace-nowrap ${
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
      {isAdmin ? (
        <span className="flex items-center gap-1 sm:justify-end">
          <button
            aria-label={`Edit ${project.name}`}
            onClick={() => setEditing(true)}
            className="rounded p-1.5 text-ink-faint transition-colors hover:bg-surface-sunken hover:text-ink"
          >
            <Pencil className="h-4 w-4" />
          </button>
          <button
            aria-label={`Delete ${project.name}`}
            onClick={() => setConfirming(true)}
            className="rounded p-1.5 text-ink-faint transition-colors hover:bg-danger-soft hover:text-danger"
          >
            <Trash2 className="h-4 w-4" />
          </button>
        </span>
      ) : (
        <span />
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
        description={`Deleting "${project.name}" will also delete its ${project.updateCount} ${
          project.updateCount === 1 ? "update" : "updates"
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

export default function ProjectsPage() {
  const isAdmin = useIsAdmin();
  const projects = useQuery(api.projects.list, {});
  const [creating, setCreating] = useState(false);
  const [search, setSearch] = useState("");

  // The list query returns every project, so filtering stays on the client.
  const query = search.trim().toLowerCase();
  const visible = projects?.filter((p) => p.name.toLowerCase().includes(query));

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-3">
        <div>
          <h1 className="text-4xl">Projects</h1>
          <p className="mt-1.5 text-sm text-ink-muted">
            Everything the community is building, and how often it gets talked about.
          </p>
        </div>
        {isAdmin && (
          <button
            onClick={() => setCreating(true)}
            className="ml-auto inline-flex items-center gap-1.5 rounded-card bg-accent px-3.5 py-2 text-sm font-medium text-on-accent transition-colors hover:bg-accent-hover"
          >
            <FolderPlus className="h-4 w-4" />
            New Project
          </button>
        )}
      </div>

      {/* Search */}
      <div className="relative max-w-md">
        <Search className="absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-ink-faint" />
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search projects by name…"
          className="w-full rounded-card border border-edge bg-surface-raised py-2.5 pr-9 pl-9 text-sm outline-none transition-colors placeholder:text-ink-faint focus:border-edge-strong"
        />
        {search && (
          <button
            aria-label="Clear search"
            onClick={() => setSearch("")}
            className="absolute top-1/2 right-3 -translate-y-1/2 text-ink-faint hover:text-ink"
          >
            <X className="h-4 w-4" />
          </button>
        )}
      </div>

      <div className="overflow-hidden rounded-card border border-edge bg-surface-raised">
        <div
          className={`hidden gap-4 border-b border-edge bg-surface-sunken px-4 py-2.5 text-[11px] font-medium tracking-wider text-ink-faint uppercase sm:grid ${GRID_COLS}`}
        >
          <span>Name</span>
          <span>Category</span>
          <span>Members</span>
          <span>Updates</span>
          <span>Status</span>
          <span />
        </div>
        {visible === undefined ? (
          <>
            <ProjectRowSkeleton />
            <ProjectRowSkeleton />
            <ProjectRowSkeleton />
            <ProjectRowSkeleton />
          </>
        ) : visible.length === 0 ? (
          <div className="p-4">
            <EmptyState
              message={query ? `No projects match “${search.trim()}”.` : "No projects yet."}
            />
          </div>
        ) : (
          visible.map((project) => <ProjectRow key={project._id} project={project} />)
        )}
      </div>

      <ProjectFormModal open={creating} onClose={() => setCreating(false)} />
    </div>
  );
}
