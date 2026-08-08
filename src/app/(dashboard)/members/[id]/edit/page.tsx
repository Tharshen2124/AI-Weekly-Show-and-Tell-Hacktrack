"use client";

import { use, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useQuery } from "convex/react";
import { ArrowLeft } from "lucide-react";
import { api } from "../../../../../../convex/_generated/api";
import { Id } from "../../../../../../convex/_generated/dataModel";
import { useAccess } from "@/lib/use-access";
import { MemberForm } from "@/components/forms/member-form";
import { ErrorState } from "@/components/ui/error-state";

export default function MemberEditPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const { isLoading, isAdmin } = useAccess();
  const member = useQuery(
    api.functions.members.get,
    isAdmin ? { id: id as Id<"members"> } : "skip",
  );

  // Admin-only route: bounce non-admins back to the detail page.
  useEffect(() => {
    if (!isLoading && !isAdmin) router.replace(`/members/${id}`);
  }, [isLoading, isAdmin, router, id]);

  if (!isAdmin) return null;
  if (member === null) {
    return <ErrorState message="This member does not exist (they may have been deleted)." />;
  }

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <Link
        href={`/members/${id}`}
        className="inline-flex items-center gap-1.5 text-sm text-ink-muted hover:text-ink"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to member
      </Link>
      <h1 className="text-4xl">Edit member</h1>
      {member === undefined ? (
        <div className="h-64 animate-pulse rounded-card bg-surface-sunken" />
      ) : (
        <div className="rounded-card border border-edge bg-surface-raised p-6">
          <MemberForm
            initial={{
              id: member._id,
              name: member.name,
              email: member.email,
              isActive: member.isActive,
              registerDate: member.registerDate,
              progressTalkNum: member.progressTalkNum,
              accessLevel: member.accessLevel ?? "none",
            }}
            onSaved={() => router.push(`/members/${id}`)}
            onCancel={() => router.push(`/members/${id}`)}
          />
        </div>
      )}
    </div>
  );
}
