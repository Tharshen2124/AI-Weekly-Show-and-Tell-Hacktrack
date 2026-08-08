"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useQuery } from "convex/react";
import {
  ArrowLeft,
  GripVertical,
  Pause,
  Play,
  Plus,
  RotateCcw,
  Shuffle,
  SkipForward,
  Users,
} from "lucide-react";
import { api } from "../../../../convex/_generated/api";

const DEFAULT_MINUTES = 10;

/** Fisher–Yates: every permutation equally likely, unlike sort(() => rand). */
function shuffle<T>(items: T[]): T[] {
  const out = [...items];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

function formatClock(totalSeconds: number): string {
  const negative = totalSeconds < 0;
  const abs = Math.abs(totalSeconds);
  const mm = String(Math.floor(abs / 60)).padStart(2, "0");
  const ss = String(abs % 60).padStart(2, "0");
  return `${negative ? "-" : ""}${mm}:${ss}`;
}

export default function PresentPage() {
  const members = useQuery(api.functions.members.list, { isActive: true, pageSize: 200 });

  const [namesInput, setNamesInput] = useState("");
  const [order, setOrder] = useState<string[] | null>(null);
  const [presenting, setPresenting] = useState(false);

  const [current, setCurrent] = useState(0);
  const [minutes, setMinutes] = useState(DEFAULT_MINUTES);
  const [secondsLeft, setSecondsLeft] = useState(DEFAULT_MINUTES * 60);
  const [running, setRunning] = useState(false);
  const [dragIndex, setDragIndex] = useState<number | null>(null);

  // Derived, not stored: one less thing that can disagree with the clock.
  const timeUp = secondsLeft <= 0;

  // Created on a click so the browser's autoplay policy lets it make noise
  // later, when the timer hits zero without any user gesture.
  const audioRef = useRef<AudioContext | null>(null);

  const ensureAudio = useCallback(() => {
    if (!audioRef.current) {
      const Ctor =
        window.AudioContext ??
        (window as unknown as { webkitAudioContext?: typeof AudioContext })
          .webkitAudioContext;
      if (Ctor) audioRef.current = new Ctor();
    }
    void audioRef.current?.resume();
  }, []);

  const playAlarm = useCallback(() => {
    const ctx = audioRef.current;
    if (!ctx) return;
    // Three short beeps, each shaped so it doesn't click on start/stop.
    [0, 0.55, 1.1].forEach((offset) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "sine";
      osc.frequency.value = 880;
      osc.connect(gain);
      gain.connect(ctx.destination);
      const at = ctx.currentTime + offset;
      gain.gain.setValueAtTime(0.0001, at);
      gain.gain.exponentialRampToValueAtTime(0.35, at + 0.03);
      gain.gain.exponentialRampToValueAtTime(0.0001, at + 0.42);
      osc.start(at);
      osc.stop(at + 0.45);
    });
  }, []);

  // The countdown itself. Keeps ticking past zero so an overrunning talk shows
  // how far over it has gone.
  useEffect(() => {
    if (!running) return;
    const id = setInterval(() => setSecondsLeft((s) => s - 1), 1000);
    return () => clearInterval(id);
  }, [running]);

  // Fires exactly once per talk: the clock only passes through 0 on the way down.
  useEffect(() => {
    if (secondsLeft === 0) playAlarm();
  }, [secondsLeft, playAlarm]);

  const parsedNames = namesInput
    .split("\n")
    .map((n) => n.trim())
    .filter(Boolean);

  const addActiveMembers = () => {
    if (!members) return;
    const existing = new Set(parsedNames.map((n) => n.toLowerCase()));
    const additions = members.data
      .map((m) => m.name)
      .filter((n) => !existing.has(n.toLowerCase()));
    setNamesInput([...parsedNames, ...additions].join("\n"));
  };

  const generate = () => {
    if (parsedNames.length === 0) return;
    setOrder(shuffle(parsedNames));
  };

  const move = (from: number, to: number) => {
    setOrder((prev) => {
      if (!prev || to < 0 || to >= prev.length) return prev;
      const next = [...prev];
      const [moved] = next.splice(from, 1);
      next.splice(to, 0, moved);
      return next;
    });
  };

  const startPresenting = () => {
    ensureAudio();
    setCurrent(0);
    setSecondsLeft(minutes * 60);
    setRunning(false);
    setPresenting(true);
  };

  const resetTimer = (mins = minutes) => {
    setSecondsLeft(mins * 60);
    setRunning(false);
  };

  const nextPresenter = () => {
    if (!order) return;
    if (current < order.length - 1) setCurrent((c) => c + 1);
    resetTimer();
  };

  // ---------- Timer view ----------
  if (presenting && order) {
    const isLast = current >= order.length - 1;
    return (
      <div className="space-y-8">
        <button
          onClick={() => setPresenting(false)}
          className="inline-flex items-center gap-1.5 text-sm text-ink-muted hover:text-ink"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to the order
        </button>

        <div
          className={`rounded-card border p-8 text-center transition-colors ${
            timeUp ? "border-danger bg-danger-soft" : "border-edge bg-surface-raised"
          }`}
        >
          <div className="flex flex-wrap items-baseline justify-between gap-2 text-sm">
            <p className="text-ink-muted">
              Current: <span className="text-xl font-medium text-ink">{order[current]}</span>
            </p>
            <p className="text-ink-muted">
              Next:{" "}
              <span className="font-medium text-ink">
                {isLast ? "— last talk —" : order[current + 1]}
              </span>
            </p>
          </div>

          <p
            aria-live="polite"
            className={`font-serif-display my-6 text-7xl tabular-nums sm:text-8xl ${
              timeUp ? "text-danger" : ""
            }`}
          >
            {formatClock(secondsLeft)}
          </p>

          {timeUp && (
            <p role="alert" className="mb-5 text-sm font-medium text-danger">
              Time&apos;s up for {order[current]}.
            </p>
          )}

          <div className="mb-5 flex items-center justify-center gap-2 text-sm text-ink-muted">
            <label htmlFor="minutes">Custom timer (minutes):</label>
            <input
              id="minutes"
              type="number"
              min={1}
              max={120}
              value={minutes}
              onChange={(e) => {
                const next = Math.max(1, Number(e.target.value) || 1);
                setMinutes(next);
                if (!running) resetTimer(next);
              }}
              className="w-20 rounded-card border border-edge bg-surface px-2 py-1 text-center text-sm outline-none focus:border-edge-strong"
            />
          </div>

          <div className="flex flex-wrap justify-center gap-2">
            <button
              onClick={() => {
                ensureAudio();
                setRunning((r) => !r);
              }}
              className="inline-flex items-center gap-1.5 rounded-card bg-accent px-4 py-2.5 text-sm font-medium text-on-accent transition-colors hover:bg-accent-hover"
            >
              {running ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
              {running ? "Pause" : secondsLeft === minutes * 60 ? "Start timer" : "Resume"}
            </button>
            <button
              onClick={() => {
                setSecondsLeft((s) => s + 60);
              }}
              className="inline-flex items-center gap-1.5 rounded-card border border-edge px-4 py-2.5 text-sm transition-colors hover:bg-surface-sunken"
            >
              <Plus className="h-4 w-4" />1 minute
            </button>
            <button
              onClick={() => resetTimer()}
              className="inline-flex items-center gap-1.5 rounded-card border border-edge px-4 py-2.5 text-sm transition-colors hover:bg-surface-sunken"
            >
              <RotateCcw className="h-4 w-4" />
              Reset
            </button>
            <button
              onClick={nextPresenter}
              disabled={isLast}
              className="inline-flex items-center gap-1.5 rounded-card border border-edge px-4 py-2.5 text-sm transition-colors hover:bg-surface-sunken disabled:opacity-40"
            >
              <SkipForward className="h-4 w-4" />
              Next presenter
            </button>
          </div>
        </div>

        <section>
          <h2 className="mb-3 text-sm font-medium tracking-wider text-ink-faint uppercase">
            Upcoming presenters
          </h2>
          {isLast ? (
            <p className="text-sm text-ink-faint">Nobody left — that was the last talk.</p>
          ) : (
            <ol className="space-y-1.5">
              {order.slice(current + 1).map((name, i) => (
                <li
                  key={`${name}-${i}`}
                  className="rounded-card border border-edge bg-surface-raised px-4 py-2.5 text-sm"
                >
                  <span className="mr-2 text-ink-faint tabular-nums">{current + i + 2}.</span>
                  {name}
                </li>
              ))}
            </ol>
          )}
        </section>
      </div>
    );
  }

  // ---------- Setup view ----------
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-4xl">So, who presents first?</h1>
        <p className="mt-1.5 text-sm text-ink-muted">
          Drop in tonight&apos;s names, shuffle them, then run the clock on each talk.
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <section className="space-y-3">
          <div className="flex items-center justify-between gap-2">
            <h2 className="text-sm font-medium tracking-wider text-ink-faint uppercase">Talks</h2>
            <button
              onClick={addActiveMembers}
              disabled={!members}
              className="inline-flex items-center gap-1.5 rounded-card border border-edge px-3 py-1.5 text-xs transition-colors hover:bg-surface-sunken disabled:opacity-50"
            >
              <Users className="h-3.5 w-3.5" />
              Add active members
            </button>
          </div>
          <textarea
            value={namesInput}
            onChange={(e) => setNamesInput(e.target.value)}
            rows={10}
            placeholder={"One name per line\n\naiden\njanelle\nhesham"}
            className="w-full rounded-card border border-edge bg-surface-raised p-3 font-mono text-sm outline-none transition-colors placeholder:text-ink-faint focus:border-edge-strong"
          />
          <div className="flex flex-wrap gap-2">
            <button
              onClick={generate}
              disabled={parsedNames.length === 0}
              className="inline-flex items-center gap-1.5 rounded-card bg-accent px-3.5 py-2 text-sm font-medium text-on-accent transition-colors hover:bg-accent-hover disabled:opacity-50"
            >
              <Shuffle className="h-4 w-4" />
              {order ? "Reshuffle" : "Generate order"}
            </button>
            <button
              onClick={() => {
                setNamesInput("");
                setOrder(null);
              }}
              className="rounded-card border border-edge px-3.5 py-2 text-sm transition-colors hover:bg-surface-sunken"
            >
              Clear all
            </button>
          </div>
          <p className="text-xs text-ink-faint">
            {parsedNames.length} {parsedNames.length === 1 ? "name" : "names"} entered
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-sm font-medium tracking-wider text-ink-faint uppercase">
            Here is the order
          </h2>
          {!order ? (
            <p className="rounded-card border border-dashed border-edge px-4 py-8 text-center text-sm text-ink-faint">
              Add some names and hit “Generate order”.
            </p>
          ) : (
            <>
              <p className="text-xs text-ink-faint">Drag rows to reorder.</p>
              <ol className="space-y-1.5">
                {order.map((name, i) => (
                  <li
                    key={`${name}-${i}`}
                    draggable
                    onDragStart={() => setDragIndex(i)}
                    onDragEnd={() => setDragIndex(null)}
                    onDragOver={(e) => e.preventDefault()}
                    onDrop={() => {
                      if (dragIndex !== null) move(dragIndex, i);
                      setDragIndex(null);
                    }}
                    className={`flex items-center gap-2 rounded-card border bg-surface-raised px-3 py-2.5 text-sm ${
                      dragIndex === i ? "border-accent opacity-60" : "border-edge"
                    }`}
                  >
                    <span className="w-5 text-ink-faint tabular-nums">{i + 1}.</span>
                    <GripVertical className="h-4 w-4 shrink-0 cursor-grab text-ink-faint" />
                    <span className="min-w-0 flex-1 truncate">{name}</span>
                    {/* Keyboard-reachable equivalent of dragging. */}
                    <span className="flex shrink-0 gap-0.5">
                      <button
                        aria-label={`Move ${name} up`}
                        onClick={() => move(i, i - 1)}
                        disabled={i === 0}
                        className="rounded px-1.5 py-0.5 text-ink-faint hover:bg-surface-sunken hover:text-ink disabled:opacity-30"
                      >
                        ↑
                      </button>
                      <button
                        aria-label={`Move ${name} down`}
                        onClick={() => move(i, i + 1)}
                        disabled={i === order.length - 1}
                        className="rounded px-1.5 py-0.5 text-ink-faint hover:bg-surface-sunken hover:text-ink disabled:opacity-30"
                      >
                        ↓
                      </button>
                    </span>
                  </li>
                ))}
              </ol>
              <button
                onClick={startPresenting}
                className="inline-flex w-full items-center justify-center gap-1.5 rounded-card bg-accent px-4 py-2.5 text-sm font-medium text-on-accent transition-colors hover:bg-accent-hover"
              >
                <Play className="h-4 w-4" />
                Start presenting
              </button>
            </>
          )}
        </section>
      </div>
    </div>
  );
}
