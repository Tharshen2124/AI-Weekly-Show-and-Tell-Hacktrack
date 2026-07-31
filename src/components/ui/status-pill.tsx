import { MEMBER_STATUS_LABELS, MemberStatus } from "@/lib/labels";

const TONE: Record<MemberStatus, string> = {
  active: "border-success/50 text-success",
  socially_active: "border-success/50 text-success",
  was_active: "border-edge-strong text-ink-muted",
  was_socially_active: "border-edge-strong text-ink-muted",
  never_active: "border-edge-strong text-ink-faint",
  registered: "border-info/50 text-info",
  contacted: "border-info/50 text-info",
  first_talk_given: "border-info/50 text-info",
  terminated: "border-danger/50 text-danger",
  duplicate: "border-edge-strong text-ink-faint",
};

export function StatusPill({ status }: { status: MemberStatus }) {
  return (
    <span
      className={`inline-flex items-center whitespace-nowrap rounded-full border px-2.5 py-0.5 text-xs font-medium ${TONE[status]}`}
    >
      {MEMBER_STATUS_LABELS[status]}
    </span>
  );
}
