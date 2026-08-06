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
import { SearchableDropdown } from "@/components/ui/searchable-dropdown";
import { InlineErrorBanner } from "@/components/ui/error-state";
import { Field, inputClass } from "./field";
import { formatDate } from "@/lib/format";

const schema = z.object({
  memberId: z.string().min(1, "A member is required"),
  projectId: z.string().min(1, "A project is required"),
  meetupId: z.string().min(1, "A meetup is required"),
  description: z.string().trim().min(1, "A description is required"),
});

interface UpdateInitial {
  id: Id<"updates">;
  memberId: Id<"members">;
  projectId: Id<"projects">;
  meetupId: Id<"meetups">;
  description: string;
}

interface UpdateFormModalProps {
  open: boolean;
  onClose: () => void;
  initial?: UpdateInitial;
}

export function UpdateFormModal({ open, onClose, initial }: UpdateFormModalProps) {
  return (
    <ModalLayout open={open} onClose={onClose} title={initial ? "Edit Update" : "New Update"}>
      {/* Mounted only while open, so state resets every time the modal reopens. */}
      {open && <UpdateFormFields initial={initial} onClose={onClose} />}
    </ModalLayout>
  );
}

function UpdateFormFields({ initial, onClose }: { initial?: UpdateInitial; onClose: () => void }) {
  const token = useAuthStore((s) => s.token);
  const toast = useToast();
  const formOptions = useQuery(api.updates.formOptions, token ? { token } : "skip");
  const createUpdate = useMutation(api.updates.create);
  const updateUpdate = useMutation(api.updates.update);

  const [memberId, setMemberId] = useState<string | null>(initial?.memberId ?? null);
  const [projectId, setProjectId] = useState<string | null>(initial?.projectId ?? null);
  const [meetupId, setMeetupId] = useState<string | null>(initial?.meetupId ?? null);
  const [description, setDescription] = useState(initial?.description ?? "");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  const memberGroups = formOptions
    ? [{ label: "", options: formOptions.members.map((m) => ({ value: m.id, label: m.name })) }]
    : [];

  const selectedMember = formOptions?.members.find((m) => m.id === memberId);

  // The project dropdown only offers the chosen member's projects.
  const projectGroups = selectedMember
    ? [{ label: "", options: selectedMember.projects.map((p) => ({ value: p.id, label: p.name })) }]
    : [];

  const meetupGroups = formOptions
    ? [
        {
          label: "",
          options: formOptions.meetups.map((m) => ({
            value: m.id,
            label: `Meetup #${m.number} — ${formatDate(m.date)}`,
          })),
        },
      ]
    : [];

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    const parsed = schema.safeParse({ memberId, projectId, meetupId, description });
    if (!parsed.success) {
      const message = parsed.error.issues[0].message;
      setError(message);
      toast.error(`Missing field: ${message}`);
      return;
    }
    if (!token) return;
    setPending(true);
    try {
      const payload = {
        token,
        memberId: parsed.data.memberId as Id<"members">,
        projectId: parsed.data.projectId as Id<"projects">,
        meetupId: parsed.data.meetupId as Id<"meetups">,
        description: parsed.data.description,
      };
      if (initial) {
        await updateUpdate({ ...payload, id: initial.id });
        toast.success("Successfully updated the talk!");
      } else {
        await createUpdate(payload);
        toast.success("Successfully added update!");
      }
      onClose();
    } catch {
      toast.error("Error occurred, update was not saved.");
    } finally {
      setPending(false);
    }
  };

  return (
    <form onSubmit={submit} className="space-y-4">
        {error && <InlineErrorBanner message={error} />}
        <Field label="Member">
          <SearchableDropdown
            groups={memberGroups}
            value={memberId}
            onChange={(v) => {
              setMemberId(v);
              setProjectId(null);
            }}
            placeholder="Select a member"
          />
        </Field>
        <Field label="Project">
          <SearchableDropdown
            groups={projectGroups}
            value={projectId}
            onChange={setProjectId}
            placeholder={memberId ? "Select a project" : "Choose a member first"}
            disabled={!memberId}
          />
        </Field>
        <Field label="Meetup">
          <SearchableDropdown
            groups={meetupGroups}
            value={meetupId}
            onChange={setMeetupId}
            placeholder="Select a meetup"
          />
        </Field>
        <Field label="Description">
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={4}
            placeholder="What was talked about?"
            className={inputClass}
          />
        </Field>
        <div className="flex justify-end gap-2 pt-2">
          <button
            type="button"
            onClick={onClose}
            className="rounded-card border border-edge px-4 py-2 text-sm hover:bg-surface-sunken"
          >
            Cancel
          </button>
          <SubmitButton pending={pending}>{initial ? "Save changes" : "Add update"}</SubmitButton>
        </div>
      </form>
  );
}
