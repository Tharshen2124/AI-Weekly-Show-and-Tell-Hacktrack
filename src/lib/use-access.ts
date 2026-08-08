"use client";

import { useConvexAuth, useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";

export type AccessState = {
  /** Clerk is still restoring the session, or the access lookup is in flight. */
  isLoading: boolean;
  /** Signed in with Google (says nothing about whether they may use the app). */
  isSignedIn: boolean;
  /** Signed in AND listed in the members table with an access level. */
  hasAccess: boolean;
  isAdmin: boolean;
  member: NonNullable<ReturnType<typeof useMe>> | null;
};

function useMe() {
  const { isAuthenticated } = useConvexAuth();
  return useQuery(api.functions.auth.me, isAuthenticated ? {} : "skip");
}

/**
 * Single source of truth for auth in the UI. Convex dedupes the underlying
 * query, so calling this from many components costs one subscription.
 */
export function useAccess(): AccessState {
  const { isLoading: authLoading, isAuthenticated } = useConvexAuth();
  const me = useMe();

  return {
    isLoading: authLoading || (isAuthenticated && me === undefined),
    isSignedIn: isAuthenticated,
    hasAccess: !!me,
    isAdmin: me?.isAdmin ?? false,
    member: me ?? null,
  };
}

/** Convenience for the many components that only gate on admin. */
export function useIsAdmin(): boolean {
  return useAccess().isAdmin;
}
