"use client";

import { useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { z } from "zod";
import { api } from "../../../convex/_generated/api";
import { Id } from "../../../convex/_generated/dataModel";
import { useToast } from "@/components/providers/toast-provider";
import { ModalLayout } from "@/components/ui/modal-layout";
import { SubmitButton } from "@/components/ui/submit-button";
import { InlineErrorBanner } from "@/components/ui/error-state";
import { Field, inputClass } from "./field";
import { todayISO } from "@/lib/format";

const schema = z.object({
  number: z.number().int().positive("Meetup number must be a positive number"),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Date is required"),
});

interface MeetupInitial {
  id: Id<"meetups">;
  number: number;
  date: string;
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
  const toast = useToast();
  const nextNumber = useQuery(api.functions.meetups.nextNumber, {});
  const createMeetup = useMutation(api.functions.meetups.create);
  const updateMeetup = useMutation(api.functions.meetups.update);

  // null = untouched; new meetups pre-fill with the next sequence number.
  const [numberInput, setNumberInput] = useState<string | null>(
    initial ? String(initial.number) : null,
  );
  const [date, setDate] = useState(initial?.date ?? todayISO());
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  const number = numberInput ?? (nextNumber !== undefined ? String(nextNumber) : "");

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
    setPending(true);
    try {
      if (initial) {
        await updateMeetup({
          id: initial.id,
          number: parsed.data.number,
          date: parsed.data.date,
        });
        toast.success("Successfully updated meetup!");
      } else {
        await createMeetup({
          number: parsed.data.number,
          date: parsed.data.date,
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

  return (
    <form onSubmit={submit} className="space-y-4">
      {error && <InlineErrorBanner message={error} />}
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
