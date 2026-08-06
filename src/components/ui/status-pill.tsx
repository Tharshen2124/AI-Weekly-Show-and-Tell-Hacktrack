export function StatusPill({ isActive }: { isActive: boolean }) {
  return (
    <span
      className={`inline-flex items-center whitespace-nowrap rounded-full border px-2.5 py-0.5 text-xs font-medium ${
        isActive ? "border-success/50 text-success" : "border-edge-strong text-ink-muted"
      }`}
    >
      {isActive ? "Active" : "Inactive"}
    </span>
  );
}
