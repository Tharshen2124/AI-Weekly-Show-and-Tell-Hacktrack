"use client";

import { Check, ChevronsUpDown, Search, X } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { DropdownOption } from "./searchable-dropdown";

interface MultiSelectDropdownProps {
  options: DropdownOption[];
  values: string[];
  onChange: (values: string[]) => void;
  placeholder?: string;
}

export function MultiSelectDropdown({
  options,
  values,
  onChange,
  placeholder = "Select…",
}: MultiSelectDropdownProps) {
  const [open, setOpen] = useState(false);
  const [filter, setFilter] = useState("");
  const [highlight, setHighlight] = useState(0);
  const rootRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);

  const filtered = useMemo(() => {
    const q = filter.trim().toLowerCase();
    return q ? options.filter((o) => o.label.toLowerCase().includes(q)) : options;
  }, [options, filter]);

  const chips = values
    .map((v) => options.find((o) => o.value === v))
    .filter((o): o is DropdownOption => !!o);

  useEffect(() => {
    if (!open) return;
    const onClick = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onClick);
    setTimeout(() => searchRef.current?.focus(), 30);
    return () => document.removeEventListener("mousedown", onClick);
  }, [open]);

  const setFilterAndResetHighlight = (value: string) => {
    setFilter(value);
    setHighlight(0);
  };

  const toggleValue = (v: string) => {
    onChange(values.includes(v) ? values.filter((x) => x !== v) : [...values, v]);
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setHighlight((h) => Math.min(h + 1, filtered.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setHighlight((h) => Math.max(h - 1, 0));
    } else if (e.key === "Enter") {
      e.preventDefault();
      if (filtered[highlight]) toggleValue(filtered[highlight].value);
    } else if (e.key === "Escape") {
      e.preventDefault();
      setOpen(false);
    }
  };

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        onClick={() => {
          setOpen((o) => !o);
          setHighlight(0);
        }}
        className="flex min-h-11 w-full items-center justify-between gap-2 rounded-card border border-edge bg-surface px-3 py-2 text-left text-sm transition-colors hover:border-edge-strong"
      >
        {chips.length === 0 ? (
          <span className="text-ink-faint">{placeholder}</span>
        ) : (
          <span className="flex flex-wrap gap-1.5">
            {chips.map((chip) => (
              <span
                key={chip.value}
                className="inline-flex items-center gap-1 rounded-full border border-edge-strong bg-surface-sunken px-2 py-0.5 text-xs"
              >
                {chip.label}
                <span
                  role="button"
                  tabIndex={0}
                  aria-label={`Remove ${chip.label}`}
                  onClick={(e) => {
                    e.stopPropagation();
                    toggleValue(chip.value);
                  }}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.stopPropagation();
                      toggleValue(chip.value);
                    }
                  }}
                  className="rounded-full p-0.5 hover:bg-edge"
                >
                  <X className="h-3 w-3" />
                </span>
              </span>
            ))}
          </span>
        )}
        <ChevronsUpDown className="h-4 w-4 shrink-0 text-ink-faint" />
      </button>

      {open && (
        <div className="absolute z-30 mt-1 w-full overflow-hidden rounded-card border border-edge bg-surface-overlay shadow-xl">
          <div className="flex items-center gap-2 border-b border-edge px-3 py-2">
            <Search className="h-4 w-4 text-ink-faint" />
            <input
              ref={searchRef}
              value={filter}
              onChange={(e) => setFilterAndResetHighlight(e.target.value)}
              onKeyDown={onKeyDown}
              placeholder="Filter…"
              className="w-full bg-transparent text-sm outline-none placeholder:text-ink-faint"
            />
          </div>
          <div className="max-h-56 overflow-y-auto py-1">
            {filtered.length === 0 && <p className="px-3 py-3 text-sm text-ink-faint">No matches.</p>}
            {filtered.map((option, index) => (
              <button
                key={option.value}
                type="button"
                onClick={() => toggleValue(option.value)}
                onMouseEnter={() => setHighlight(index)}
                className={`flex w-full items-center justify-between px-3 py-2 text-left text-sm ${
                  index === highlight ? "bg-surface-sunken" : ""
                }`}
              >
                {option.label}
                {values.includes(option.value) && <Check className="h-4 w-4 text-success" />}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
