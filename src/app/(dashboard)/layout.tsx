"use client";

import { ReactNode, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useQuery } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { useAuthStore } from "@/lib/auth-store";
import { Navbar } from "@/components/nav/navbar";

export default function DashboardLayout({ children }: { children: ReactNode }) {
  const router = useRouter();
  const { token, isHydrated, hydrate, clearSession } = useAuthStore();

  useEffect(() => {
    if (!isHydrated) hydrate();
  }, [isHydrated, hydrate]);

  useEffect(() => {
    if (isHydrated && !token) router.replace("/login");
  }, [isHydrated, token, router]);

  // Server-side validation of a restored cookie; UX guard only — every query
  // re-checks the token anyway.
  const check = useQuery(api.auth.check, token ? { token } : "skip");
  useEffect(() => {
    if (check && !check.valid) {
      clearSession();
      router.replace("/login");
    }
  }, [check, clearSession, router]);

  // Cookies don't exist during SSR: render nothing until hydrated to avoid
  // hydration mismatches (no spinner, no flash).
  if (!isHydrated || !token) return null;

  return (
    <div className="min-h-dvh">
      <Navbar />
      <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6">{children}</main>
    </div>
  );
}
