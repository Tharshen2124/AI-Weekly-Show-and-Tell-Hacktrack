"use client";

import { ReactNode } from "react";

export function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-sm font-medium text-ink-muted">{label}</span>
      {children}
    </label>
  );
}

export const inputClass =
  "w-full rounded-card border border-edge bg-surface px-3 py-2.5 text-sm outline-none transition-colors placeholder:text-ink-faint focus:border-edge-strong";

export function RadioRow<T extends string>({
  options,
  value,
  onChange,
  name,
}: {
  options: { value: T; label: string }[];
  value: T;
  onChange: (v: T) => void;
  name: string;
}) {
  return (
    <div className="flex flex-wrap gap-2">
      {options.map((option) => (
        <label
          key={option.value}
          className={`cursor-pointer rounded-full border px-3.5 py-1.5 text-sm transition-colors ${
            value === option.value
              ? "border-accent bg-accent text-on-accent"
              : "border-edge text-ink-muted hover:border-edge-strong"
          }`}
        >
          <input
            type="radio"
            name={name}
            value={option.value}
            checked={value === option.value}
            onChange={() => onChange(option.value)}
            className="sr-only"
          />
          {option.label}
        </label>
      ))}
    </div>
  );
}
