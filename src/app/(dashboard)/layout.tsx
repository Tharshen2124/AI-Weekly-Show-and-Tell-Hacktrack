"use client";

import { ReactNode, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAccess } from "@/lib/use-access";
import { Navbar } from "@/components/nav/navbar";
import { Attribution } from "@/components/ui/attribution";
import { TranscriptionQueueTray } from "@/components/ui/transcription-queue-tray";

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
    <div className="flex min-h-dvh flex-col">
      <Navbar />
      <main className="mx-auto w-full max-w-7xl flex-1 px-4 py-8 sm:px-6">{children}</main>
      <footer className="border-t border-edge">
        <div className="mx-auto max-w-7xl px-4 py-5 text-xs text-ink-faint sm:px-6">
          <Attribution />
        </div>
      </footer>
      <TranscriptionQueueTray />
    </div>
  );
}
