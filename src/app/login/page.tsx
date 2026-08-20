"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { SignInButton, useClerk } from "@clerk/nextjs";
import { AnimatePresence, motion } from "motion/react";
import { Loader2, TriangleAlert } from "lucide-react";
import { useAccess } from "@/lib/use-access";

const SLIDES = [
  {
    gradient: "linear-gradient(160deg, #0b1f23 0%, #16333a 60%, #275d6b 100%)",
    quote: "Every Thursday, someone ships something.",
  },
  {
    gradient: "linear-gradient(160deg, #10282d 0%, #2f6b4f 120%)",
    quote: "Ideas become working demos.",
  },
  {
    gradient: "linear-gradient(160deg, #081619 0%, #0f2a2e 55%, #4f6367 140%)",
    quote: "The ledger remembers every demo.",
  },
];

function GoogleMark() {
  return (
    <svg className="h-4 w-4" viewBox="0 0 24 24" aria-hidden>
      <path
        fill="#4285F4"
        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1Z"
      />
      <path
        fill="#34A853"
        d="M12 23c2.97 0 5.46-.98 7.28-2.65l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84A11 11 0 0 0 12 23Z"
      />
      <path
        fill="#FBBC05"
        d="M5.84 14.11a6.6 6.6 0 0 1 0-4.22V7.05H2.18a11 11 0 0 0 0 9.9l3.66-2.84Z"
      />
      <path
        fill="#EA4335"
        d="M12 4.75c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 1.46 14.97.5 12 .5A11 11 0 0 0 2.18 7.05l3.66 2.84c.87-2.6 3.3-4.14 6.16-4.14Z"
      />
    </svg>
  );
}

export default function LoginPage() {
  const router = useRouter();
  const { signOut } = useClerk();
  const { isLoading, isSignedIn, hasAccess, member } = useAccess();
  const [slide, setSlide] = useState(0);

  // Someone with access never stays here.
  useEffect(() => {
    if (hasAccess) router.replace("/dashboard");
  }, [hasAccess, router]);

  // Rotating carousel, 5s interval.
  useEffect(() => {
    const interval = setInterval(() => setSlide((s) => (s + 1) % SLIDES.length), 5000);
    return () => clearInterval(interval);
  }, []);

  // Signed in with Google but not on the roster: the whole point of the allowlist.
  const deniedAccess = !isLoading && isSignedIn && !hasAccess;

  return (
    <div className="flex min-h-dvh">
      {/* Rotating art carousel — md+ only */}
      <div className="relative hidden w-1/2 overflow-hidden md:block">
        <AnimatePresence mode="popLayout">
          <motion.div
            key={slide}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 1 }}
            className="absolute inset-0"
            style={{ background: SLIDES[slide].gradient }}
          />
        </AnimatePresence>
        <div
          aria-hidden
          className="absolute inset-0 opacity-[0.07]"
          style={{
            backgroundImage:
              "linear-gradient(rgba(245,242,234,0.6) 1px, transparent 1px), linear-gradient(90deg, rgba(245,242,234,0.6) 1px, transparent 1px)",
            backgroundSize: "48px 48px",
          }}
        />
        <div className="absolute inset-0 flex flex-col justify-between p-10">
          <span className="font-brand text-lg font-semibold text-[#f5f2ea]">
            Show<span className="text-[#a9babc]">&amp;</span>Tell
          </span>
          <AnimatePresence mode="wait">
            <motion.p
              key={slide}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.5 }}
              className="font-serif-display max-w-sm text-3xl text-[#f5f2ea] italic"
            >
              “{SLIDES[slide].quote}”
            </motion.p>
          </AnimatePresence>
        </div>
      </div>

      {/* Sign-in half */}
      <div className="flex w-full items-center justify-center px-6 md:w-1/2">
        <div className="w-full max-w-sm">
          <h1 className="text-4xl">Welcome back</h1>
          <p className="mt-2 text-sm text-ink-muted">
            Sign in with the Google account you registered with.
          </p>

          {deniedAccess ? (
            <div className="mt-8 space-y-4">
              <div
                role="alert"
                className="flex items-start gap-3 rounded-card border border-danger/40 bg-danger-soft p-4"
              >
                <TriangleAlert className="mt-0.5 h-5 w-5 shrink-0 text-danger" />
                <div>
                  <p className="text-sm font-medium text-danger">
                    You do not have access to this site
                  </p>
                  <p className="mt-1 text-sm text-ink-muted">
                    Ask an organiser to add{" "}
                    <span className="font-medium">{member?.email ?? "your account"}</span> before
                    signing in again.
                  </p>
                </div>
              </div>
              <button
                onClick={() => signOut({ redirectUrl: "/login" })}
                className="w-full rounded-card border border-edge px-4 py-2.5 text-sm transition-colors hover:bg-surface-sunken"
              >
                Sign in with a different account
              </button>
            </div>
          ) : (
            <div className="mt-8 space-y-3">
              <SignInButton mode="modal" forceRedirectUrl="/dashboard">
                <button
                  disabled={isLoading}
                  className="flex w-full items-center justify-center gap-2.5 rounded-card border border-edge bg-surface-raised px-4 py-2.5 text-sm font-medium transition-colors hover:bg-surface-sunken disabled:opacity-60"
                >
                  {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <GoogleMark />}
                  Continue with Google
                </button>
              </SignInButton>
              <p className="text-center text-xs text-ink-faint">
                Access is limited to registered community members.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
