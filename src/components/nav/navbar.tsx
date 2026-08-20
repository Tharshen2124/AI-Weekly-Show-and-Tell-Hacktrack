"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { AnimatePresence, motion } from "motion/react";
import { LogOut, Menu, Moon, ShieldCheck, Sun, X } from "lucide-react";
import { useState } from "react";
import { useClerk } from "@clerk/nextjs";
import { useAccess } from "@/lib/use-access";
import { useTheme } from "@/components/providers/theme-provider";
import { useToast } from "@/components/providers/toast-provider";

const LINKS = [
  { href: "/dashboard", label: "Dashboard" },
  { href: "/members", label: "Members" },
  { href: "/meetups", label: "Meetups" },
  { href: "/projects", label: "Projects" },
];

function Brand() {
  return (
    <Link href="/dashboard" className="font-brand text-lg font-semibold">
      Hack<span className="text-ink-muted">Track</span>
    </Link>
  );
}

export function Navbar() {
  const pathname = usePathname();
  const { isAdmin } = useAccess();
  const { signOut } = useClerk();
  const { theme, toggle } = useTheme();
  const toast = useToast();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const handleLogout = async () => {
    toast.info("Logged out.");
    await signOut({ redirectUrl: "/login" });
  };

  const navLink = (href: string, label: string, block = false) => {
    const active = pathname.startsWith(href);
    return (
      <Link
        key={href}
        href={href}
        onClick={() => setSidebarOpen(false)}
        className={`${block ? "block rounded-card px-3 py-2.5 text-base" : "rounded-card px-3 py-1.5 text-sm"} transition-colors ${
          active
            ? "bg-surface-sunken font-medium text-ink"
            : "text-ink-muted hover:bg-surface-sunken hover:text-ink"
        }`}
      >
        {label}
      </Link>
    );
  };

  return (
    <header className="sticky top-0 z-40 border-b border-edge bg-surface/90 backdrop-blur">
      <div className="mx-auto flex h-14 max-w-7xl items-center gap-3 px-4 sm:px-6">
        <button
          aria-label="Open menu"
          onClick={() => setSidebarOpen(true)}
          className="rounded-card p-2 text-ink-muted hover:bg-surface-sunken lg:hidden"
        >
          <Menu className="h-5 w-5" />
        </button>

        <Brand />

        <nav className="ml-6 hidden items-center gap-1 lg:flex">
          {LINKS.map((l) => navLink(l.href, l.label))}
        </nav>

        <div className="ml-auto flex items-center gap-2">
          {isAdmin && (
            <span className="hidden items-center gap-1.5 rounded-full border border-success/50 px-2.5 py-1 text-xs font-medium text-success sm:inline-flex">
              <ShieldCheck className="h-3.5 w-3.5" />
              Admin Mode
            </span>
          )}
          <button
            aria-label="Toggle dark mode"
            onClick={toggle}
            className="rounded-card p-2 text-ink-muted transition-colors hover:bg-surface-sunken hover:text-ink"
          >
            {theme === "dark" ? <Sun className="h-4.5 w-4.5" /> : <Moon className="h-4.5 w-4.5" />}
          </button>
          <button
            onClick={handleLogout}
            className="inline-flex items-center gap-1.5 rounded-card px-3 py-1.5 text-sm text-ink-muted transition-colors hover:bg-surface-sunken hover:text-ink"
          >
            <LogOut className="h-4 w-4" />
            <span className="hidden sm:inline">Logout</span>
          </button>
        </div>
      </div>

      {/* Mobile slide-in sidebar */}
      <AnimatePresence>
        {sidebarOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-40 bg-ink/40 lg:hidden dark:bg-black/60"
              onClick={() => setSidebarOpen(false)}
            />
            <motion.aside
              initial={{ x: "-100%" }}
              animate={{ x: 0 }}
              exit={{ x: "-100%" }}
              transition={{ type: "tween", duration: 0.2 }}
              className="fixed top-0 left-0 z-50 flex h-dvh w-72 flex-col border-r border-edge bg-surface p-4 lg:hidden"
            >
              <div className="mb-6 flex items-center justify-between">
                <Brand />
                <button
                  aria-label="Close menu"
                  onClick={() => setSidebarOpen(false)}
                  className="rounded-card p-2 text-ink-muted hover:bg-surface-sunken"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>
              <nav className="flex flex-col gap-1">
                {LINKS.map((l) => navLink(l.href, l.label, true))}
              </nav>
              {isAdmin && (
                <span className="mt-6 inline-flex w-fit items-center gap-1.5 rounded-full border border-success/50 px-2.5 py-1 text-xs font-medium text-success">
                  <ShieldCheck className="h-3.5 w-3.5" />
                  Admin Mode
                </span>
              )}
            </motion.aside>
          </>
        )}
      </AnimatePresence>
    </header>
  );
}
