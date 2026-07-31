"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";

interface PaginationProps {
  page: number;
  totalPages: number;
  onPageChange: (page: number) => void;
  /** Members grid uses a fixed floating pill at bottom-right. */
  floating?: boolean;
}

export function Pagination({ page, totalPages, onPageChange, floating }: PaginationProps) {
  const base =
    "flex items-center gap-1 rounded-full border border-edge bg-surface-overlay px-2 py-1.5 text-sm shadow-sm";
  const wrapper = floating ? `fixed bottom-5 right-5 z-40 shadow-lg ${base}` : base;
  return (
    <div className={wrapper}>
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
  );
}
