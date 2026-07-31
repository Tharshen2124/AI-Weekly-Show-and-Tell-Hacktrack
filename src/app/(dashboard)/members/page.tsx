"use client";

import { useEffect, useRef, useState } from "react";
import { useQuery } from "convex/react";
import { Check, ListFilter, Search, UserPlus, X } from "lucide-react";
import { api } from "../../../../convex/_generated/api";
import { useAuthStore } from "@/lib/auth-store";
import { MemberCard } from "@/components/cards/member-card";
import { MemberForm } from "@/components/forms/member-form";
import { ModalLayout } from "@/components/ui/modal-layout";
import { Pagination } from "@/components/ui/pagination";
import { CardGridSkeleton } from "@/components/ui/skeletons";
import { EmptyState } from "@/components/ui/error-state";
import {
  ALL_MEMBER_STATUSES,
  MEMBER_SORT_LABELS,
  MEMBER_STATUS_LABELS,
  MemberSort,
  MemberStatus,
} from "@/lib/labels";

const DEFAULT_STATUSES: MemberStatus[] = ["active", "socially_active"];

export default function MembersPage() {
  const token = useAuthStore((s) => s.token);
  const isAdmin = useAuthStore((s) => s.isAdmin);

  const [statuses, setStatuses] = useState<MemberStatus[]>(DEFAULT_STATUSES);
  const [sortBy, setSortBy] = useState<MemberSort>("recent_talks");
  const [page, setPage] = useState(1);
  const [searchInput, setSearchInput] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [filterOpen, setFilterOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const filterRef = useRef<HTMLDivElement>(null);

  // 300ms debounce on search.
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(searchInput.trim()), 300);
    return () => clearTimeout(timer);
  }, [searchInput]);

  useEffect(() => {
    if (!filterOpen) return;
    const onClick = (e: MouseEvent) => {
      if (filterRef.current && !filterRef.current.contains(e.target as Node)) setFilterOpen(false);
    };
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, [filterOpen]);

  const searching = debouncedSearch !== "";

  const list = useQuery(
    api.members.list,
    token && !searching ? { token, statuses, sortBy, page } : "skip",
  );
  const searchResults = useQuery(
    api.members.search,
    token && searching ? { token, query: debouncedSearch } : "skip",
  );

  const setStatusesAndReset = (next: MemberStatus[]) => {
    setStatuses(next);
    setPage(1);
  };
  const toggleStatus = (status: MemberStatus) => {
    setStatusesAndReset(
      statuses.includes(status) ? statuses.filter((s) => s !== status) : [...statuses, status],
    );
  };

  const allSelected = statuses.length === 0;
  const members = searching ? searchResults : list?.data;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="text-4xl">Members</h1>
        {/* Active filter chips at md+ */}
        <div className="hidden flex-wrap gap-1.5 md:flex">
          {(allSelected ? [] : statuses).map((status) => (
            <button
              key={status}
              onClick={() => toggleStatus(status)}
              className="inline-flex items-center gap-1 rounded-full border border-edge-strong bg-surface-sunken px-2.5 py-1 text-xs text-ink-muted transition-colors hover:text-ink"
            >
              {MEMBER_STATUS_LABELS[status]}
              <X className="h-3 w-3" />
            </button>
          ))}
          {allSelected && (
            <span className="rounded-full border border-edge px-2.5 py-1 text-xs text-ink-faint">
              All statuses
            </span>
          )}
        </div>

        <div className="ml-auto flex items-center gap-2">
          {isAdmin && (
            <button
              onClick={() => setCreating(true)}
              className="inline-flex items-center gap-1.5 rounded-card bg-accent px-3.5 py-2 text-sm font-medium text-on-accent transition-colors hover:bg-accent-hover"
            >
              <UserPlus className="h-4 w-4" />
              New Member
            </button>
          )}
          {/* Filter + sort popover */}
          <div ref={filterRef} className="relative">
            <button
              onClick={() => setFilterOpen((o) => !o)}
              className="inline-flex items-center gap-1.5 rounded-card border border-edge px-3.5 py-2 text-sm transition-colors hover:bg-surface-sunken"
            >
              <ListFilter className="h-4 w-4" />
              Filter
            </button>
            {filterOpen && (
              <div className="absolute right-0 z-30 mt-1 w-64 rounded-card border border-edge bg-surface-overlay p-3 shadow-xl">
                <p className="mb-2 text-[11px] font-medium tracking-wider text-ink-faint uppercase">
                  Status
                </p>
                <div className="space-y-1">
                  <button
                    onClick={() => setStatusesAndReset([])}
                    className="flex w-full items-center justify-between rounded px-2 py-1.5 text-sm hover:bg-surface-sunken"
                  >
                    All
                    {allSelected && <Check className="h-4 w-4 text-success" />}
                  </button>
                  {ALL_MEMBER_STATUSES.map((status) => (
                    <button
                      key={status}
                      onClick={() => toggleStatus(status)}
                      className="flex w-full items-center justify-between rounded px-2 py-1.5 text-sm hover:bg-surface-sunken"
                    >
                      {MEMBER_STATUS_LABELS[status]}
                      {statuses.includes(status) && <Check className="h-4 w-4 text-success" />}
                    </button>
                  ))}
                </div>
                <p className="mt-3 mb-2 border-t border-edge pt-3 text-[11px] font-medium tracking-wider text-ink-faint uppercase">
                  Sort by
                </p>
                <div className="space-y-1">
                  {(Object.keys(MEMBER_SORT_LABELS) as MemberSort[]).map((sort) => (
                    <button
                      key={sort}
                      onClick={() => {
                        setSortBy(sort);
                        setPage(1);
                      }}
                      className="flex w-full items-center justify-between rounded px-2 py-1.5 text-sm hover:bg-surface-sunken"
                    >
                      {MEMBER_SORT_LABELS[sort]}
                      {sortBy === sort && <Check className="h-4 w-4 text-success" />}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Search */}
      <div className="relative max-w-md">
        <Search className="absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-ink-faint" />
        <input
          value={searchInput}
          onChange={(e) => setSearchInput(e.target.value)}
          placeholder="Search members by name…"
          className="w-full rounded-card border border-edge bg-surface-raised py-2.5 pr-9 pl-9 text-sm outline-none transition-colors placeholder:text-ink-faint focus:border-edge-strong"
        />
        {searchInput && (
          <button
            aria-label="Clear search"
            onClick={() => setSearchInput("")}
            className="absolute top-1/2 right-3 -translate-y-1/2 text-ink-faint hover:text-ink"
          >
            <X className="h-4 w-4" />
          </button>
        )}
      </div>

      {/* Grid */}
      {members === undefined ? (
        <CardGridSkeleton count={8} kind="member" />
      ) : members.length === 0 ? (
        <EmptyState
          message={
            searching ? `No members match “${debouncedSearch}”.` : "No members match these filters."
          }
        />
      ) : (
        <div className="grid grid-cols-1 gap-4 pb-20 md:grid-cols-2 xl:grid-cols-4">
          {members.map((member) => (
            <MemberCard key={member._id} member={member} />
          ))}
        </div>
      )}

      {/* Floating pagination — hidden while searching */}
      {!searching && list && list.totalPages > 1 && (
        <Pagination page={page} totalPages={list.totalPages} onPageChange={setPage} floating />
      )}

      <ModalLayout open={creating} onClose={() => setCreating(false)} title="New Member" wide>
        <MemberForm onSaved={() => setCreating(false)} onCancel={() => setCreating(false)} />
      </ModalLayout>
    </div>
  );
}
