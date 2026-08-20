"use client";

import { useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { motion } from "motion/react";
import { ArrowUpRight, CalendarDays, MapPin, Timer } from "lucide-react";
import { useAccess } from "@/lib/use-access";
import { Attribution } from "@/components/ui/attribution";

const TITLE = "Show&Tell";
/** The org's Luma calendar, not a single event — each week gets its own listing. */
const LUMA_CALENDAR_URL = "https://luma.com/malaysianai";
const MALAYSIAN_AI_URL = "https://www.malaysian.ai/";

/** The standing shape of the meetup this tracker records. */
const EVENT_DETAILS = [
  { Icon: CalendarDays, text: "Thursdays, 5–6PM" },
  { Icon: MapPin, text: "500 Global Office, AICB, KL" },
  { Icon: Timer, text: "4 min demo + 2 min feedback" },
];

export default function LandingPage() {
  const router = useRouter();
  const { hasAccess } = useAccess();

  useEffect(() => {
    if (hasAccess) router.replace("/dashboard");
  }, [hasAccess, router]);

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

      <motion.header
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.6 }}
        className="relative z-10 flex items-center px-6 py-5 sm:px-10"
      >
        <a
          href={MALAYSIAN_AI_URL}
          target="_blank"
          rel="noreferrer noopener"
          className="font-brand text-sm font-semibold tracking-tight transition-opacity hover:opacity-80"
        >
          Malaysian<span className="text-[#a9babc]">.ai</span>
        </a>
      </motion.header>

      <main className="relative z-10 flex flex-1 flex-col items-center justify-center px-6 py-16 text-center">
        <h1 className="flex text-6xl sm:text-8xl" aria-label="Show and Tell">
          {TITLE.split("").map((letter, i) => (
            <motion.span
              key={i}
              initial={{ opacity: 0, y: 28, filter: "blur(6px)" }}
              animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
              transition={{ delay: 0.15 + i * 0.06, duration: 0.5, ease: "easeOut" }}
              className={letter === "&" ? "text-[#86b7c2]" : undefined}
              aria-hidden
            >
              {letter}
            </motion.span>
          ))}
        </h1>
        <motion.p
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.85, duration: 0.5 }}
          className="mt-5 max-w-md text-lg text-[#a9babc]"
        >
          The running record of what Malaysian AI builders are building.
        </motion.p>

        <motion.ul
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 1.0, duration: 0.5 }}
          className="mt-8 flex flex-col items-center gap-2.5 text-sm text-[#6e8285] sm:flex-row sm:gap-6"
        >
          {EVENT_DETAILS.map(({ Icon, text }) => (
            <li key={text} className="inline-flex items-center gap-2">
              <Icon className="h-4 w-4 shrink-0" aria-hidden />
              {text}
            </li>
          ))}
        </motion.ul>

        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 1.15, duration: 0.5 }}
          className="mt-9 flex flex-col items-center gap-3 sm:flex-row"
        >
          <Link
            href="/login"
            className="rounded-card bg-[#f5f2ea] px-7 py-3 text-sm font-medium text-[#0b1f23] transition-transform hover:scale-[1.03]"
          >
            Login
          </Link>
          <a
            href={LUMA_CALENDAR_URL}
            target="_blank"
            rel="noreferrer noopener"
            className="inline-flex items-center gap-1.5 rounded-card border border-[#1e3a40] px-7 py-3 text-sm font-medium text-[#f5f2ea] transition-colors hover:border-[#2f4f56] hover:bg-[#10282d]"
          >
            See upcoming events
            <ArrowUpRight className="h-4 w-4" />
          </a>
        </motion.div>
      </main>

      <footer className="relative z-10 border-t border-[#1e3a40] px-6 py-5 text-center text-xs text-[#6e8285]">
        <p>
          The tracker for the Weekly Show &amp; Tell at the{" "}
          <a
            href={MALAYSIAN_AI_URL}
            target="_blank"
            rel="noreferrer noopener"
            className="underline underline-offset-2 transition-opacity hover:opacity-80"
          >
            Malaysian AI
          </a>{" "}
          Residency. Private to members — ask an organiser for access.
        </p>
        <p className="mt-1.5">
          <Attribution />
        </p>
      </footer>
    </div>
  );
}
