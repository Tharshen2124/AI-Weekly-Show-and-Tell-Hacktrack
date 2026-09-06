"use client";

import { useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { z } from "zod";
import { api } from "../../../convex/_generated/api";
import { Id } from "../../../convex/_generated/dataModel";
import { useToast } from "@/components/providers/toast-provider";
import { ModalLayout } from "@/components/ui/modal-layout";
import { SubmitButton } from "@/components/ui/submit-button";
import { SearchableDropdown } from "@/components/ui/searchable-dropdown";
import { InlineErrorBanner } from "@/components/ui/error-state";
import { DictationButton } from "@/components/ui/dictation-button";
import { transcribeAudio } from "@/lib/transcribe";
import { useTranscriptionQueue } from "@/lib/transcription-queue";
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
  const toast = useToast();
  const formOptions = useQuery(api.functions.updates.formOptions, {});
  const createUpdate = useMutation(api.functions.updates.create);
  const updateUpdate = useMutation(api.functions.updates.update);
  const enqueue = useTranscriptionQueue((s) => s.enqueue);

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

  const selectedProject = selectedMember?.projects.find((p) => p.id === projectId);
  // Nothing can be queued until the update is identified, since the queue saves
  // it without coming back to this form.
  const identified = Boolean(memberId && projectId && meetupId);
  const queueLabel = `${selectedMember?.name ?? ""} · ${selectedProject?.name ?? ""}`;

  /**
   * New updates hand the clip to the background queue and close, so the scribe
   * can start the next person while this one transcribes.
   */
  const queueRecording = (blob: Blob, extension: string) => {
    enqueue({
      memberId: memberId as Id<"members">,
      projectId: projectId as Id<"projects">,
      meetupId: meetupId as Id<"meetups">,
      label: queueLabel,
      blob,
      extension,
    });
    toast.info(`Queued ${queueLabel} — transcribing in the background.`);
    onClose();
  };

  /**
   * Edits transcribe in place instead: the update already exists, and someone
   * editing it is sitting here waiting for the text anyway.
   */
  const transcribeInline = async (blob: Blob, extension: string) => {
    try {
      const text = await transcribeAudio(blob, extension);
      if (!text) {
        toast.info("No speech was picked up in that recording.");
        return;
      }
      // Appended, so typed text and a second take both survive.
      setDescription((prev) => (prev.trim() ? `${prev.trim()} ${text}` : text));
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not transcribe the audio.");
    }
  };

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
    setPending(true);
    try {
      const payload = {
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
        <div>
          {/* The mic sits outside the label: a control nested in a <label> also
              retargets its clicks at the textarea. */}
          <div className="mb-1.5 flex items-center justify-between gap-2">
            <label htmlFor="update-description" className="text-sm font-medium text-ink-muted">
              Description
            </label>
            {initial ? (
              <DictationButton onRecorded={transcribeInline} />
            ) : (
              <DictationButton
                onRecorded={queueRecording}
                label="Record & queue"
                disabled={!identified}
                title={
                  identified
                    ? "Record now — this update saves itself once transcribed"
                    : "Choose a member, project, and meetup first"
                }
              />
            )}
          </div>
          <textarea
            id="update-description"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={4}
            placeholder="What was talked about?"
            className={inputClass}
          />
          {!initial && (
            <p className="mt-1.5 text-xs text-ink-faint">
              Recording saves this update on its own once transcribed, so you can move straight to
              the next person. Type here instead to write it out by hand.
            </p>
          )}
        </div>
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
