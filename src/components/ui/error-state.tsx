import { CloudOff } from "lucide-react";

export function ErrorState({ message = "Something went wrong loading this view." }: { message?: string }) {
  return (
    <div className="flex flex-col items-center gap-3 rounded-card border border-dashed border-edge-strong px-6 py-14 text-center">
      <CloudOff className="h-8 w-8 text-ink-faint" />
      <p className="max-w-sm text-sm text-ink-muted">{message}</p>
    </div>
  );
}

export function InlineErrorBanner({ message }: { message: string }) {
  return (
    <div className="rounded-card border border-danger/30 bg-danger-soft px-3 py-2 text-sm text-danger">
      {message}
    </div>
  );
}

export function EmptyState({ message }: { message: string }) {
  return (
    <div className="rounded-card border border-dashed border-edge px-6 py-12 text-center text-sm text-ink-faint">
      {message}
    </div>
  );
}
