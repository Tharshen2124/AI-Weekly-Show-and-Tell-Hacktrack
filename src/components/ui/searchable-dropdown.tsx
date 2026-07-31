"use client";

import { Check, ChevronsUpDown, Search } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";

export interface DropdownOption {
  value: string;
  label: string;
}

export interface DropdownGroup {
  label: string;
  options: DropdownOption[];
}

interface SearchableDropdownProps {
  /** Flat options, or groups (e.g. "Yet To Host" / "Have Hosted"). */
  groups: DropdownGroup[];
  value: string | null;
  onChange: (value: string | null) => void;
  placeholder?: string;
  disabled?: boolean;
  clearable?: boolean;
}

export function SearchableDropdown({
  groups,
  value,
  onChange,
  placeholder = "Select…",
  disabled,
  clearable,
}: SearchableDropdownProps) {
  const [open, setOpen] = useState(false);
  const [filter, setFilter] = useState("");
  const [highlight, setHighlight] = useState(0);
  const rootRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);

  const filteredGroups = useMemo(() => {
    const q = filter.trim().toLowerCase();
    return groups
      .map((g) => ({
        ...g,
        options: q ? g.options.filter((o) => o.label.toLowerCase().includes(q)) : g.options,
      }))
      .filter((g) => g.options.length > 0);
  }, [groups, filter]);

  const flat = useMemo(() => filteredGroups.flatMap((g) => g.options), [filteredGroups]);
  const selected = groups.flatMap((g) => g.options).find((o) => o.value === value) ?? null;

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

  const toggleOpen = () => {
    setOpen((o) => !o);
    setHighlight(0);
  };

  const select = (v: string) => {
    onChange(v);
    setOpen(false);
    setFilter("");
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setHighlight((h) => Math.min(h + 1, flat.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setHighlight((h) => Math.max(h - 1, 0));
    } else if (e.key === "Enter") {
      e.preventDefault();
      if (flat[highlight]) select(flat[highlight].value);
    } else if (e.key === "Escape") {
      e.preventDefault();
      setOpen(false);
    }
  };

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        disabled={disabled}
        onClick={toggleOpen}
        className="flex w-full items-center justify-between gap-2 rounded-card border border-edge bg-surface px-3 py-2.5 text-left text-sm transition-colors hover:border-edge-strong disabled:cursor-not-allowed disabled:opacity-50"
      >
        <span className={selected ? "" : "text-ink-faint"}>
          {selected ? selected.label : placeholder}
        </span>
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
            {clearable && (
              <button
                type="button"
                onClick={() => {
                  onChange(null);
                  setOpen(false);
                  setFilter("");
                }}
                className="w-full px-3 py-2 text-left text-sm text-ink-faint hover:bg-surface-sunken"
              >
                — None —
              </button>
            )}
            {flat.length === 0 && (
              <p className="px-3 py-3 text-sm text-ink-faint">No matches.</p>
            )}
            {filteredGroups.map((group) => (
              <div key={group.label}>
                {group.label && (
                  <p className="px-3 pt-2 pb-1 text-[11px] font-medium tracking-wider text-ink-faint uppercase">
                    {group.label}
                  </p>
                )}
                {group.options.map((option) => {
                  const index = flat.indexOf(option);
                  return (
                    <button
                      key={option.value}
                      type="button"
                      onClick={() => select(option.value)}
                      onMouseEnter={() => setHighlight(index)}
                      className={`flex w-full items-center justify-between px-3 py-2 text-left text-sm ${
                        index === highlight ? "bg-surface-sunken" : ""
                      }`}
                    >
                      {option.label}
                      {option.value === value && <Check className="h-4 w-4 text-success" />}
                    </button>
                  );
                })}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
