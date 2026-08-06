"use client";

import { useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { z } from "zod";
import { api } from "../../../convex/_generated/api";
import { Id } from "../../../convex/_generated/dataModel";
import { useAuthStore } from "@/lib/auth-store";
import { useToast } from "@/components/providers/toast-provider";
import { ModalLayout } from "@/components/ui/modal-layout";
import { SubmitButton } from "@/components/ui/submit-button";
import { MultiSelectDropdown } from "@/components/ui/multi-select-dropdown";
import { InlineErrorBanner } from "@/components/ui/error-state";
import { Field, inputClass, RadioRow } from "./field";
import { ProjectCategory } from "@/lib/labels";

const schema = z.object({
  name: z.string().trim().min(1, "Project name is required"),
  memberIds: z.array(z.string()).min(1, "At least one member is required"),
});

interface ProjectInitial {
  id: Id<"projects">;
  name: string;
  category: ProjectCategory;
  completed: boolean;
  memberIds: Id<"members">[];
}

interface ProjectFormModalProps {
  open: boolean;
  onClose: () => void;
  initial?: ProjectInitial;
}

export function ProjectFormModal({ open, onClose, initial }: ProjectFormModalProps) {
  return (
    <ModalLayout open={open} onClose={onClose} title={initial ? "Edit Project" : "New Project"}>
      {/* Mounted only while open, so state resets every time the modal reopens. */}
      {open && <ProjectFormFields initial={initial} onClose={onClose} />}
    </ModalLayout>
  );
}

function ProjectFormFields({ initial, onClose }: { initial?: ProjectInitial; onClose: () => void }) {
  const token = useAuthStore((s) => s.token);
  const toast = useToast();
  const formOptions = useQuery(api.updates.formOptions, token ? { token } : "skip");
  const createProject = useMutation(api.projects.create);
  const updateProject = useMutation(api.projects.update);

  const [name, setName] = useState(initial?.name ?? "");
  const [category, setCategory] = useState<ProjectCategory>(initial?.category ?? "solo");
  const [completed, setCompleted] = useState(initial?.completed ?? false);
  const [memberIds, setMemberIds] = useState<string[]>(initial?.memberIds ?? []);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    const parsed = schema.safeParse({ name, memberIds });
    if (!parsed.success) {
      const message = parsed.error.issues[0].message;
      setError(message);
      toast.error(`Missing field: ${message}`);
      return;
    }
    if (!token) return;
    setPending(true);
    try {
      if (initial) {
        await updateProject({
          token,
          id: initial.id,
          name: parsed.data.name,
          category,
          completed,
          memberIds: memberIds as Id<"members">[],
        });
        toast.success("Successfully updated project!");
      } else {
        await createProject({
          token,
          name: parsed.data.name,
          category,
          completed,
          memberIds: memberIds as Id<"members">[],
        });
        toast.success("Successfully added project!");
      }
      onClose();
    } catch {
      toast.error("Error occurred, project was not saved.");
    } finally {
      setPending(false);
    }
  };

  const memberOptions =
    formOptions?.members.map((m) => ({ value: m.id, label: m.name })) ?? [];

  return (
    <form onSubmit={submit} className="space-y-4">
        {error && <InlineErrorBanner message={error} />}
        <Field label="Name">
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. LRT Live Map"
            className={inputClass}
          />
        </Field>
        <Field label="Members">
          <MultiSelectDropdown
            options={memberOptions}
            values={memberIds}
            onChange={setMemberIds}
            placeholder="Select members"
          />
        </Field>
        <Field label="Category">
          <RadioRow
            name="project-category"
            value={category}
            onChange={setCategory}
            options={[
              { value: "solo", label: "Solo" },
              { value: "group", label: "Group" },
            ]}
          />
        </Field>
        <label className="flex cursor-pointer items-center gap-2.5 text-sm">
          <input
            type="checkbox"
            checked={completed}
            onChange={(e) => setCompleted(e.target.checked)}
            className="h-4 w-4 accent-[var(--accent)]"
          />
          Is project completed?
        </label>
        <div className="flex justify-end gap-2 pt-2">
          <button
            type="button"
            onClick={onClose}
            className="rounded-card border border-edge px-4 py-2 text-sm hover:bg-surface-sunken"
          >
            Cancel
          </button>
          <SubmitButton pending={pending}>{initial ? "Save changes" : "Add project"}</SubmitButton>
        </div>
      </form>
  );
}
