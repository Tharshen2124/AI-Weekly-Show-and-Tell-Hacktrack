"use client";

import { Loader2, Mic, Square } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { useToast } from "@/components/providers/toast-provider";

/**
 * OpenAI picks its decoder from the filename, so every candidate carries the
 * extension that matches it. Chrome and Firefox record webm; Safari only mp4.
 */
const FORMATS = [
  { mimeType: "audio/webm;codecs=opus", extension: "webm" },
  { mimeType: "audio/webm", extension: "webm" },
  { mimeType: "audio/mp4", extension: "mp4" },
  { mimeType: "audio/ogg;codecs=opus", extension: "ogg" },
];

/** Speech needs nothing near a browser default, and smaller uploads finish sooner. */
const AUDIO_BITS_PER_SECOND = 32000;

function pickFormat() {
  if (typeof MediaRecorder === "undefined") return null;
  return FORMATS.find((f) => MediaRecorder.isTypeSupported(f.mimeType)) ?? null;
}

function formatElapsed(seconds: number) {
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`;
}

type Status = "idle" | "recording" | "working";

interface DictationButtonProps {
  /**
   * Handed the finished clip. Whatever it returns is awaited, so a caller that
   * transcribes inline shows a busy button while a caller that only queues the
   * clip hands the button straight back.
   */
  onRecorded: (blob: Blob, extension: string) => void | Promise<void>;
  /** Shown on the button when idle. */
  label?: string;
  /** Shown while `onRecorded` is still pending. */
  busyLabel?: string;
  disabled?: boolean;
  /** Explains a disabled button, e.g. which fields are still missing. */
  title?: string;
}

/** Records from the microphone and hands the clip to its caller. */
export function DictationButton({
  onRecorded,
  label = "Dictate",
  busyLabel = "Transcribing…",
  disabled,
  title,
}: DictationButtonProps) {
  const toast = useToast();
  const [status, setStatus] = useState<Status>("idle");
  const [elapsed, setElapsed] = useState(0);

  const recorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  // `onRecorded` is read through a ref so a caller may pass an inline arrow
  // without restarting a recording that is already running.
  const onRecordedRef = useRef(onRecorded);
  useEffect(() => {
    onRecordedRef.current = onRecorded;
  });

  useEffect(() => {
    return () => {
      // Whatever happens, the mic must not stay open past this component.
      recorderRef.current?.stop();
      streamRef.current?.getTracks().forEach((track) => track.stop());
    };
  }, []);

  // Recording has no progress of its own, so the timer stands in for one.
  useEffect(() => {
    if (status !== "recording") return;
    const id = setInterval(() => setElapsed((s) => s + 1), 1000);
    return () => clearInterval(id);
  }, [status]);

  const start = useCallback(async () => {
    const format = pickFormat();
    if (!format || !navigator.mediaDevices?.getUserMedia) {
      toast.error("This browser cannot record audio. Try Chrome, Edge, Safari, or Firefox.");
      return;
    }

    let stream: MediaStream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    } catch {
      // Denied, dismissed, or no input device — the browser does not say which.
      toast.error("Microphone access was blocked. Allow it in your browser settings to dictate.");
      return;
    }

    const recorder = new MediaRecorder(stream, {
      mimeType: format.mimeType,
      audioBitsPerSecond: AUDIO_BITS_PER_SECOND,
    });
    chunksRef.current = [];
    recorder.ondataavailable = (event) => {
      if (event.data.size > 0) chunksRef.current.push(event.data);
    };
    recorder.onstop = () => {
      // Release the mic first, so the browser's recording indicator clears even
      // if handing the clip on then fails.
      stream.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
      recorderRef.current = null;
      const chunks = chunksRef.current;
      chunksRef.current = [];

      const blob = new Blob(chunks, { type: format.mimeType });
      if (blob.size === 0) {
        toast.error("Nothing was recorded.");
        setStatus("idle");
        return;
      }
      void Promise.resolve(onRecordedRef.current(blob, format.extension)).finally(() =>
        setStatus("idle"),
      );
    };

    streamRef.current = stream;
    recorderRef.current = recorder;
    recorder.start();
    setElapsed(0);
    setStatus("recording");
  }, [toast]);

  const stop = useCallback(() => {
    // `onstop` runs asynchronously and takes it from here.
    recorderRef.current?.stop();
    setStatus("working");
  }, []);

  const recording = status === "recording";
  const busy = status === "working";

  return (
    <div className="flex items-center gap-2">
      {recording && (
        <span className="flex items-center gap-1.5 text-xs tabular-nums text-ink-faint">
          <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-danger" />
          {formatElapsed(elapsed)}
        </span>
      )}
      <button
        type="button"
        onClick={recording ? stop : start}
        disabled={disabled || busy}
        aria-label={recording ? "Stop recording" : label}
        title={title ?? (recording ? "Stop recording" : label)}
        className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-60 ${
          recording
            ? "border-danger/30 bg-danger-soft text-danger"
            : "border-edge text-ink-muted hover:border-edge-strong hover:text-ink"
        }`}
      >
        {busy ? (
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
        ) : recording ? (
          <Square className="h-3.5 w-3.5 fill-current" />
        ) : (
          <Mic className="h-3.5 w-3.5" />
        )}
        {busy ? busyLabel : recording ? "Stop" : label}
      </button>
    </div>
  );
}
