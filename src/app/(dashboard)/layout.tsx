"use client";

import { ReactNode, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAccess } from "@/lib/use-access";
import { Navbar } from "@/components/nav/navbar";

export default function DashboardLayout({ children }: { children: ReactNode }) {
  const router = useRouter();
  const { isLoading, hasAccess } = useAccess();

  // Covers both "not signed in" and "signed in without access"; the login page
  // decides which message to show.
  useEffect(() => {
    if (!isLoading && !hasAccess) router.replace("/login");
  }, [isLoading, hasAccess, router]);

  // Render nothing until access is known, so no page flashes before the redirect.
  if (isLoading || !hasAccess) return null;

  return (
    <div className="min-h-dvh">
      <Navbar />
      <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6">{children}</main>
    </div>
  );
}
