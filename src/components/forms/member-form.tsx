"use client";

import { useState } from "react";
import { useMutation } from "convex/react";
import { z } from "zod";
import { api } from "../../../convex/_generated/api";
import { Id } from "../../../convex/_generated/dataModel";
import { useToast } from "@/components/providers/toast-provider";
import { SubmitButton } from "@/components/ui/submit-button";
import { InlineErrorBanner } from "@/components/ui/error-state";
import { Field, inputClass } from "./field";
import { todayISO } from "@/lib/format";

const schema = z.object({
  name: z.string().trim().min(1, "Name is required"),
  email: z.string().trim().email("A valid email is required"),
  registerDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Register date is required"),
});

/** "none" is the UI spelling of an absent accessLevel: on the roster, no sign-in. */
export type AccessChoice = "none" | "member" | "admin";

const ACCESS_LABELS: Record<AccessChoice, string> = {
  none: "No access",
  member: "Member — can view",
  admin: "Admin — can edit",
};

export interface MemberFormValues {
  id?: Id<"members">;
  name: string;
  email: string;
  isActive: boolean;
  registerDate: string;
  accessLevel: AccessChoice;
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
  const toast = useToast();
  const createMember = useMutation(api.functions.members.create);
  const updateMember = useMutation(api.functions.members.update);

  const [values, setValues] = useState<MemberFormValues>(
    initial ?? {
      name: "",
      email: "",
      isActive: false,
      registerDate: todayISO(),
      accessLevel: "none",
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
    setPending(true);
    try {
      const payload = {
        name: parsed.data.name,
        email: parsed.data.email,
        isActive: values.isActive,
        registerDate: parsed.data.registerDate,
      };
      const accessLevel = values.accessLevel === "none" ? null : values.accessLevel;
      if (initial?.id) {
        await updateMember({ ...payload, id: initial.id, accessLevel });
        toast.success("Successfully updated member!");
      } else {
        await createMember({ ...payload, accessLevel: accessLevel ?? undefined });
        toast.success("Successfully added member!");
      }
      onSaved();
    } catch (e) {
      // Surface the real reason for the two rejections an admin can actually hit.
      const message = e instanceof Error ? e.message : "";
      if (message.includes("already uses that email")) {
        setError("Another member already uses that email.");
        toast.error("Another member already uses that email.");
      } else if (message.includes("your own admin access")) {
        setError("You cannot remove your own admin access.");
        toast.error("You cannot remove your own admin access.");
      } else {
        toast.error("Error occurred, member was not saved.");
      }
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
        <Field label="Register date">
          <input
            type="date"
            value={values.registerDate}
            onChange={(e) => set("registerDate", e.target.value)}
            className={inputClass}
          />
        </Field>
      </div>
      <Field label="App access">
        <select
          value={values.accessLevel}
          onChange={(e) => set("accessLevel", e.target.value as AccessChoice)}
          className={inputClass}
        >
          {(Object.keys(ACCESS_LABELS) as AccessChoice[]).map((level) => (
            <option key={level} value={level}>
              {ACCESS_LABELS[level]}
            </option>
          ))}
        </select>
        <p className="mt-1.5 text-xs text-ink-faint">
          Anything other than “No access” lets this person sign in with the Google account
          matching their email above.
        </p>
      </Field>
      <label className="flex cursor-pointer items-center gap-2.5 text-sm">
        <input
          type="checkbox"
          checked={values.isActive}
          onChange={(e) => set("isActive", e.target.checked)}
          className="h-4 w-4 accent-[var(--accent)]"
        />
        Is this member active?
      </label>
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
