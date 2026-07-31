"use client";

import { useState } from "react";
import { ModalLayout } from "./modal-layout";
import { Loader2, TriangleAlert } from "lucide-react";

interface ConfirmDialogProps {
  open: boolean;
  onClose: () => void;
  onConfirm: () => Promise<void> | void;
  title: string;
  /** Must name the cascade, e.g. "This will also delete 4 updates." */
  description: string;
  confirmLabel?: string;
}

export function ConfirmDialog({
  open,
  onClose,
  onConfirm,
  title,
  description,
  confirmLabel = "Delete",
}: ConfirmDialogProps) {
  const [pending, setPending] = useState(false);

  return (
    <ModalLayout open={open} onClose={pending ? () => {} : onClose} title={title}>
      <div className="flex items-start gap-3">
        <div className="rounded-full bg-danger-soft p-2 text-danger">
          <TriangleAlert className="h-5 w-5" />
        </div>
        <p className="pt-1.5 text-sm text-ink-muted">{description}</p>
      </div>
      <div className="mt-6 flex justify-end gap-2">
        <button
          onClick={onClose}
          disabled={pending}
          className="rounded-card border border-edge px-4 py-2 text-sm transition-colors hover:bg-surface-sunken disabled:opacity-50"
        >
          Cancel
        </button>
        <button
          onClick={async () => {
            setPending(true);
            try {
              await onConfirm();
              onClose();
            } finally {
              setPending(false);
            }
          }}
          disabled={pending}
          className="inline-flex items-center gap-2 rounded-card bg-danger px-4 py-2 text-sm font-medium text-white transition-opacity hover:opacity-90 disabled:opacity-60 dark:text-surface-sunken"
        >
          {pending && <Loader2 className="h-4 w-4 animate-spin" />}
          {confirmLabel}
        </button>
      </div>
    </ModalLayout>
  );
}
