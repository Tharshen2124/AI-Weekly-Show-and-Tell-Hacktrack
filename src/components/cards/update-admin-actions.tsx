"use client";

import { useState } from "react";
import { Pencil, Trash2 } from "lucide-react";
import { useMutation } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { Id } from "../../../convex/_generated/dataModel";
import { useToast } from "@/components/providers/toast-provider";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { UpdateFormModal } from "@/components/forms/update-form-modal";

interface UpdateAdminActionsProps {
  update: {
    id: Id<"updates">;
    memberId: Id<"members">;
    projectId: Id<"projects">;
    meetupId: Id<"meetups">;
    description: string;
  };
}

/** Edit + delete affordances for a single update row (admin only). */
export function UpdateAdminActions({ update }: UpdateAdminActionsProps) {
  const toast = useToast();
  const removeUpdate = useMutation(api.updates.remove);
  const [editing, setEditing] = useState(false);
  const [confirming, setConfirming] = useState(false);

  return (
    <span className="flex shrink-0 items-center gap-1">
      <button
        aria-label="Edit update"
        onClick={() => setEditing(true)}
        className="rounded p-1.5 text-ink-faint transition-colors hover:bg-surface-sunken hover:text-ink"
      >
        <Pencil className="h-3.5 w-3.5" />
      </button>
      <button
        aria-label="Delete update"
        onClick={() => setConfirming(true)}
        className="rounded p-1.5 text-ink-faint transition-colors hover:bg-danger-soft hover:text-danger"
      >
        <Trash2 className="h-3.5 w-3.5" />
      </button>
      <UpdateFormModal open={editing} onClose={() => setEditing(false)} initial={update} />
      <ConfirmDialog
        open={confirming}
        onClose={() => setConfirming(false)}
        title="Delete update"
        description="This permanently removes this talk from the record. This cannot be undone."
        onConfirm={async () => {
          try {
            await removeUpdate({ id: update.id });
            toast.success("Successfully deleted update!");
          } catch {
            toast.error("Error occurred, update was not deleted.");
          }
        }}
      />
    </span>
  );
}
