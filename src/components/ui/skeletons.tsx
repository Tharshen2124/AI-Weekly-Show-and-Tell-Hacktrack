function Bone({ className = "" }: { className?: string }) {
  return <div className={`animate-pulse rounded bg-surface-sunken dark:bg-surface-raised ${className}`} />;
}

/** Matches MemberCard's real dimensions. */
export function MemberCardSkeleton() {
  return (
    <div className="rounded-card border border-edge bg-surface-raised p-4">
      <div className="flex items-start justify-between gap-2">
        <Bone className="h-6 w-32" />
        <Bone className="h-5 w-20 rounded-full" />
      </div>
      <div className="mt-4 space-y-2.5">
        <Bone className="h-4 w-full" />
        <Bone className="h-4 w-5/6" />
        <Bone className="h-4 w-2/3" />
      </div>
      <div className="mt-4 border-t border-edge pt-3">
        <Bone className="h-4 w-24" />
      </div>
    </div>
  );
}

/** Matches MeetupCard / HackathonCard. */
export function MeetupCardSkeleton() {
  return (
    <div className="rounded-card border border-edge bg-surface-raised p-4">
      <Bone className="h-6 w-28" />
      <div className="mt-3 space-y-2">
        <Bone className="h-4 w-24" />
        <Bone className="h-4 w-32" />
      </div>
    </div>
  );
}

export function ProjectRowSkeleton() {
  return (
    <div className="flex items-center gap-4 border-b border-edge px-4 py-3.5">
      <Bone className="h-5 w-40" />
      <Bone className="h-4 w-20" />
      <Bone className="ml-auto h-4 w-24" />
    </div>
  );
}

export function StatSkeleton() {
  return (
    <div className="rounded-card border border-edge bg-surface-raised p-4">
      <Bone className="h-4 w-16" />
      <Bone className="mt-3 h-8 w-12" />
    </div>
  );
}

export function CardGridSkeleton({
  count,
  kind,
}: {
  count: number;
  kind: "member" | "meetup";
}) {
  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
      {Array.from({ length: count }).map((_, i) =>
        kind === "member" ? <MemberCardSkeleton key={i} /> : <MeetupCardSkeleton key={i} />,
      )}
    </div>
  );
}
