"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useMutation } from "convex/react";
import { AnimatePresence, motion } from "motion/react";
import { Eye, EyeOff, Loader2 } from "lucide-react";
import { api } from "../../../convex/_generated/api";
import { useAuthStore } from "@/lib/auth-store";
import { useToast } from "@/components/providers/toast-provider";

const SLIDES = [
  {
    gradient: "linear-gradient(160deg, #0b1f23 0%, #16333a 60%, #275d6b 100%)",
    quote: "Every Thursday, someone ships something.",
  },
  {
    gradient: "linear-gradient(160deg, #10282d 0%, #2f6b4f 120%)",
    quote: "Idea talks become progress talks.",
  },
  {
    gradient: "linear-gradient(160deg, #081619 0%, #0f2a2e 55%, #4f6367 140%)",
    quote: "The ledger remembers every demo.",
  },
];

export default function LoginPage() {
  const router = useRouter();
  const toast = useToast();
  const login = useMutation(api.auth.login);
  const { token, isHydrated, hydrate, setSession } = useAuthStore();

  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);
  const [pending, setPending] = useState(false);
  const [slowNote, setSlowNote] = useState(false);
  const [slide, setSlide] = useState(0);
  const slowTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!isHydrated) hydrate();
  }, [isHydrated, hydrate]);

  useEffect(() => {
    if (isHydrated && token) router.replace("/dashboard");
  }, [isHydrated, token, router]);

  // Rotating carousel, 5s interval.
  useEffect(() => {
    const interval = setInterval(() => setSlide((s) => (s + 1) % SLIDES.length), 5000);
    return () => clearInterval(interval);
  }, []);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password === "") {
      toast.error("Please enter the password.");
      return;
    }
    setPending(true);
    setSlowNote(false);
    slowTimer.current = setTimeout(() => setSlowNote(true), 5000);
    try {
      const session = await login({ password, rememberMe });
      setSession(session);
      toast.success("Welcome back!");
      router.replace("/dashboard");
    } catch {
      toast.error("Invalid password.");
    } finally {
      if (slowTimer.current) clearTimeout(slowTimer.current);
      setSlowNote(false);
      setPending(false);
    }
  };

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
            Hack<span className="text-[#a9babc]">Track</span>
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

      {/* Form half */}
      <div className="flex w-full items-center justify-center px-6 md:w-1/2">
        <div className="w-full max-w-sm">
          <h1 className="text-4xl">Welcome back</h1>
          <p className="mt-2 text-sm text-ink-muted">
            Enter the shared community password to continue.
          </p>

          <form onSubmit={submit} className="mt-8 space-y-4">
            <div>
              <label className="mb-1.5 block text-sm font-medium text-ink-muted" htmlFor="password">
                Password
              </label>
              <div className="relative">
                <input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  autoFocus
                  className="w-full rounded-card border border-edge bg-surface-raised px-3 py-2.5 pr-11 text-sm outline-none transition-colors focus:border-edge-strong"
                />
                <button
                  type="button"
                  aria-label={showPassword ? "Hide password" : "Show password"}
                  onClick={() => setShowPassword((s) => !s)}
                  className="absolute top-1/2 right-3 -translate-y-1/2 text-ink-faint transition-colors hover:text-ink"
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            <label className="flex cursor-pointer items-center gap-2.5 text-sm text-ink-muted">
              <input
                type="checkbox"
                checked={rememberMe}
                onChange={(e) => setRememberMe(e.target.checked)}
                className="h-4 w-4 accent-[var(--accent)]"
              />
              Remember me for 30 days
            </label>

            <button
              type="submit"
              disabled={pending}
              className="flex w-full items-center justify-center gap-2 rounded-card bg-accent px-4 py-2.5 text-sm font-medium text-on-accent transition-colors hover:bg-accent-hover disabled:opacity-60"
            >
              {pending && <Loader2 className="h-4 w-4 animate-spin" />}
              Log in
            </button>

            {slowNote && (
              <p className="text-center text-xs text-ink-faint">
                This may take a while — the backend is waking up…
              </p>
            )}
          </form>
        </div>
      </div>
    </div>
  );
}
