"use client";

import { useState } from "react";
import { useMutation } from "convex/react";
import { z } from "zod";
import { api } from "../../../convex/_generated/api";
import { Id } from "../../../convex/_generated/dataModel";
import { useAuthStore } from "@/lib/auth-store";
import { useToast } from "@/components/providers/toast-provider";
import { SubmitButton } from "@/components/ui/submit-button";
import { SearchableDropdown } from "@/components/ui/searchable-dropdown";
import { InlineErrorBanner } from "@/components/ui/error-state";
import { Field, inputClass } from "./field";
import { ALL_MEMBER_STATUSES, MEMBER_STATUS_LABELS, MemberStatus } from "@/lib/labels";
import { todayISO } from "@/lib/format";

const schema = z.object({
  name: z.string().trim().min(1, "Name is required"),
  email: z.string().trim().email("A valid email is required"),
  registerDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Register date is required"),
});

export interface MemberFormValues {
  id?: Id<"members">;
  name: string;
  email: string;
  contactNumber: string;
  discordTag: string;
  status: MemberStatus;
  comment: string;
  registerDate: string;
}

export function MemberForm({
  initial,
  onSaved,
  onCancel,
}: {
  initial?: MemberFormValues;
  onSaved: () => void;
  onCancel: () => void;
}) {
  const token = useAuthStore((s) => s.token);
  const toast = useToast();
  const createMember = useMutation(api.members.create);
  const updateMember = useMutation(api.members.update);

  const [values, setValues] = useState<MemberFormValues>(
    initial ?? {
      name: "",
      email: "",
      contactNumber: "",
      discordTag: "",
      status: "registered",
      comment: "",
      registerDate: todayISO(),
    },
  );
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  const set = <K extends keyof MemberFormValues>(key: K, value: MemberFormValues[K]) =>
    setValues((v) => ({ ...v, [key]: value }));

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    const parsed = schema.safeParse(values);
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
        name: parsed.data.name,
        email: parsed.data.email,
        contactNumber: values.contactNumber.trim() || undefined,
        discordTag: values.discordTag.trim() || undefined,
        status: values.status,
        comment: values.comment.trim() || undefined,
        registerDate: parsed.data.registerDate,
      };
      if (initial?.id) {
        await updateMember({ ...payload, id: initial.id });
        toast.success("Successfully updated member!");
      } else {
        await createMember(payload);
        toast.success("Successfully added member!");
      }
      onSaved();
    } catch {
      toast.error("Error occurred, member was not saved.");
    } finally {
      setPending(false);
    }
  };

  return (
    <form onSubmit={submit} className="space-y-4">
      {error && <InlineErrorBanner message={error} />}
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Name">
          <input value={values.name} onChange={(e) => set("name", e.target.value)} className={inputClass} />
        </Field>
        <Field label="Email">
          <input
            type="email"
            value={values.email}
            onChange={(e) => set("email", e.target.value)}
            className={inputClass}
          />
        </Field>
        <Field label="Contact number">
          <input
            value={values.contactNumber}
            onChange={(e) => set("contactNumber", e.target.value)}
            placeholder="Optional"
            className={inputClass}
          />
        </Field>
        <Field label="Discord tag">
          <input
            value={values.discordTag}
            onChange={(e) => set("discordTag", e.target.value)}
            placeholder="Optional"
            className={inputClass}
          />
        </Field>
        <Field label="Status">
          <SearchableDropdown
            groups={[
              {
                label: "",
                options: ALL_MEMBER_STATUSES.map((s) => ({
                  value: s,
                  label: MEMBER_STATUS_LABELS[s],
                })),
              },
            ]}
            value={values.status}
            onChange={(v) => v && set("status", v as MemberStatus)}
          />
        </Field>
        <Field label="Register date">
          <input
            type="date"
            value={values.registerDate}
            onChange={(e) => set("registerDate", e.target.value)}
            className={inputClass}
          />
        </Field>
      </div>
      <Field label="Comment">
        <textarea
          value={values.comment}
          onChange={(e) => set("comment", e.target.value)}
          rows={3}
          placeholder="Optional"
          className={inputClass}
        />
      </Field>
      <div className="flex justify-end gap-2 pt-2">
        <button
          type="button"
          onClick={onCancel}
          className="rounded-card border border-edge px-4 py-2 text-sm hover:bg-surface-sunken"
        >
          Cancel
        </button>
        <SubmitButton pending={pending}>{initial?.id ? "Save changes" : "Add member"}</SubmitButton>
      </div>
    </form>
  );
}
