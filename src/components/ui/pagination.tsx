"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";

interface PaginationProps {
  /**
   * The page being shown. Where the query clamps and returns the page it served,
   * pass that rather than local state — the Next button steps up from this value,
   * so a stale number would leave it pointing at a page that no longer exists.
   */
  page: number;
  totalPages: number;
  onPageChange: (page: number) => void;
}

/**
 * The pager for every list page. It owns its own placement — centred, in normal
 * flow, below the content — so pages drop it in without a wrapper, and it renders
 * nothing at all when there is only one page to show.
 */
export function Pagination({ page, totalPages, onPageChange }: PaginationProps) {
  if (totalPages <= 1) return null;

  return (
    <div className="flex justify-center">
      <div className="flex items-center gap-1 rounded-full border border-edge bg-surface-overlay px-2 py-1.5 text-sm shadow-sm">
        <button
          aria-label="Previous page"
          disabled={page <= 1}
          onClick={() => onPageChange(page - 1)}
          className="rounded-full p-1.5 transition-colors hover:bg-surface-sunken disabled:cursor-not-allowed disabled:opacity-40"
        >
          <ChevronLeft className="h-4 w-4" />
        </button>
        <span className="min-w-16 text-center tabular-nums text-ink-muted">
          {page} – {totalPages}
        </span>
        <button
          aria-label="Next page"
          disabled={page >= totalPages}
          onClick={() => onPageChange(page + 1)}
          className="rounded-full p-1.5 transition-colors hover:bg-surface-sunken disabled:cursor-not-allowed disabled:opacity-40"
        >
          <ChevronRight className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
