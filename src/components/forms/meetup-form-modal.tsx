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
import { Field, inputClass, RadioRow } from "./field";
import { todayISO } from "@/lib/format";

const schema = z.object({
  number: z.number().int().positive("Meetup number must be a positive number"),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Date is required"),
});

type MeetupCategory = "regular_meetup" | "hackathon" | "off_record_meetup";

interface MeetupInitial {
  id: Id<"meetups">;
  number: number;
  date: string;
  category: MeetupCategory;
  hostId: Id<"members"> | null;
}

interface MeetupFormModalProps {
  open: boolean;
  onClose: () => void;
  /** When set, the form edits an existing meetup. */
  initial?: MeetupInitial;
}

export function MeetupFormModal({ open, onClose, initial }: MeetupFormModalProps) {
  return (
    <ModalLayout open={open} onClose={onClose} title={initial ? "Edit Meetup" : "New Meetup"}>
      {/* Mounted only while open, so state resets every time the modal reopens. */}
      {open && <MeetupFormFields initial={initial} onClose={onClose} />}
    </ModalLayout>
  );
}

function MeetupFormFields({ initial, onClose }: { initial?: MeetupInitial; onClose: () => void }) {
  const token = useAuthStore((s) => s.token);
  const toast = useToast();
  const nextNumbers = useQuery(api.meetups.nextNumbers, token ? { token } : "skip");
  const hostOptions = useQuery(api.meetups.hostOptions, token ? { token } : "skip");
  const createMeetup = useMutation(api.meetups.create);
  const updateMeetup = useMutation(api.meetups.update);

  const [category, setCategory] = useState<MeetupCategory>(initial?.category ?? "regular_meetup");
  // null = untouched; the pre-fill is derived so it re-fills when the category changes (§3.2).
  const [numberInput, setNumberInput] = useState<string | null>(
    initial ? String(initial.number) : null,
  );
  const [date, setDate] = useState(initial?.date ?? todayISO());
  const [hostId, setHostId] = useState<string | null>(initial?.hostId ?? null);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  const prefill =
    nextNumbers === undefined
      ? null
      : category === "hackathon"
        ? nextNumbers.hackathon
        : nextNumbers.regularMeetup;
  const number = numberInput ?? (prefill !== null ? String(prefill) : "");

  const onCategoryChange = (c: MeetupCategory) => {
    setCategory(c);
    if (!initial) setNumberInput(null); // re-pre-fill for the new category
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    const parsed = schema.safeParse({ number: Number(number), date });
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
        await updateMeetup({
          token,
          id: initial.id,
          number: parsed.data.number,
          date: parsed.data.date,
          category,
          hostId: (hostId as Id<"members"> | null) ?? null,
        });
        toast.success("Successfully updated meetup!");
      } else {
        await createMeetup({
          token,
          number: parsed.data.number,
          date: parsed.data.date,
          category,
          hostId: (hostId as Id<"members"> | null) ?? undefined,
        });
        toast.success("Successfully added meetup!");
      }
      onClose();
    } catch {
      toast.error("Error occurred, meetup was not saved.");
    } finally {
      setPending(false);
    }
  };

  const hostGroups = hostOptions
    ? [
        {
          label: "Yet To Host",
          options: hostOptions.yetToHost.map((m) => ({ value: m.id, label: m.name })),
        },
        {
          label: "Have Hosted",
          options: hostOptions.haveHosted.map((m) => ({ value: m.id, label: m.name })),
        },
      ]
    : [];

  return (
    <form onSubmit={submit} className="space-y-4">
      {error && <InlineErrorBanner message={error} />}
      <Field label="Category">
        <RadioRow
          name="meetup-category"
          value={category}
          onChange={onCategoryChange}
          options={[
            { value: "regular_meetup", label: "Regular Meetup" },
            { value: "hackathon", label: "Hackathon" },
            ...(initial?.category === "off_record_meetup"
              ? [{ value: "off_record_meetup" as const, label: "Off-Record" }]
              : []),
          ]}
        />
      </Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Number">
          <input
            type="number"
            min={1}
            value={number}
            onChange={(e) => setNumberInput(e.target.value)}
            className={inputClass}
          />
        </Field>
        <Field label="Date">
          <input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className={inputClass}
          />
        </Field>
      </div>
      <Field label="Host">
        <SearchableDropdown
          groups={hostGroups}
          value={hostId}
          onChange={setHostId}
          placeholder="Select a host (optional)"
          clearable
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
        <SubmitButton pending={pending}>{initial ? "Save changes" : "Add meetup"}</SubmitButton>
      </div>
    </form>
  );
}
