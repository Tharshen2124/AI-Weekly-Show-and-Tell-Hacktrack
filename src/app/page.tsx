"use client";

import { useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { motion } from "motion/react";
import { useAuthStore } from "@/lib/auth-store";

const TITLE = "HackTrack";

export default function LandingPage() {
  const router = useRouter();
  const { token, isHydrated, hydrate } = useAuthStore();

  useEffect(() => {
    if (!isHydrated) hydrate();
  }, [isHydrated, hydrate]);

  useEffect(() => {
    if (isHydrated && token) router.replace("/dashboard");
  }, [isHydrated, token, router]);

  return (
    <div className="relative flex min-h-dvh flex-col overflow-hidden bg-[#0b1f23] text-[#f5f2ea]">
      {/* Full-bleed layered background */}
      <div
        aria-hidden
        className="absolute inset-0"
        style={{
          background:
            "radial-gradient(80rem 40rem at 70% -10%, rgba(245,242,234,0.08), transparent 60%), radial-gradient(50rem 30rem at 10% 110%, rgba(134,183,194,0.12), transparent 60%), linear-gradient(180deg, #081619 0%, #0b1f23 45%, #10282d 100%)",
        }}
      />
      <div
        aria-hidden
        className="absolute inset-0 opacity-[0.06]"
        style={{
          backgroundImage:
            "linear-gradient(rgba(245,242,234,0.5) 1px, transparent 1px), linear-gradient(90deg, rgba(245,242,234,0.5) 1px, transparent 1px)",
          backgroundSize: "56px 56px",
        }}
      />

      <main className="relative z-10 flex flex-1 flex-col items-center justify-center px-6 text-center">
        <h1 className="flex text-6xl sm:text-8xl" aria-label={TITLE}>
          {TITLE.split("").map((letter, i) => (
            <motion.span
              key={i}
              initial={{ opacity: 0, y: 28, filter: "blur(6px)" }}
              animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
              transition={{ delay: 0.15 + i * 0.06, duration: 0.5, ease: "easeOut" }}
              aria-hidden
            >
              {letter}
            </motion.span>
          ))}
        </h1>
        <motion.p
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.9, duration: 0.5 }}
          className="mt-5 max-w-md text-lg text-[#a9babc]"
        >
          Who spoke, what they built, and who&apos;s gone quiet — the meetup ledger for our maker
          community.
        </motion.p>
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 1.15, duration: 0.5 }}
          className="mt-9"
        >
          <Link
            href="/login"
            className="rounded-card bg-[#f5f2ea] px-7 py-3 text-sm font-medium text-[#0b1f23] transition-transform hover:scale-[1.03]"
          >
            Login
          </Link>
        </motion.div>
      </main>

      <footer className="relative z-10 border-t border-[#1e3a40] px-6 py-5 text-center text-xs text-[#6e8285]">
        A private dashboard for members. Ask an organiser for the password.
      </footer>
    </div>
  );
}
