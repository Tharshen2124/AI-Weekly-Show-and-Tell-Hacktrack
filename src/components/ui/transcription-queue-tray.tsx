"use client";

import { AnimatePresence, motion } from "motion/react";
import { AlertTriangle, Loader2, RotateCw, X } from "lucide-react";
import { useCallback, useEffect } from "react";
import { useMutation } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { useToast } from "@/components/providers/toast-provider";
import { transcribeAudio } from "@/lib/transcribe";
import { QueuedUpdate, useTranscriptionQueue } from "@/lib/transcription-queue";

/**
 * Drains the dictation queue and shows what is still in flight.
 *
 * Mounted once in the dashboard layout: the scribe records someone, the modal
 * closes immediately, and the transcribe-then-save happens here while they move
 * on to the next person.
 */
export function TranscriptionQueueTray() {
  const toast = useToast();
  const createUpdate = useMutation(api.functions.updates.create);
  const items = useTranscriptionQueue((s) => s.items);
  const activeId = useTranscriptionQueue((s) => s.activeId);

  const process = useCallback(
    async (item: QueuedUpdate) => {
      const { setActive, fail, remove } = useTranscriptionQueue.getState();
      try {
        const text = await transcribeAudio(item.blob, item.extension);
        if (!text) throw new Error("No speech was picked up.");
        await createUpdate({
          memberId: item.memberId,
          projectId: item.projectId,
          meetupId: item.meetupId,
          description: text,
        });
        remove(item.id);
        toast.success(`Saved ${item.label}.`);
      } catch (error) {
        const message = error instanceof Error ? error.message : "Could not save this update.";
        fail(item.id, message);
        toast.error(`${item.label}: ${message}`);
      } finally {
        setActive(null);
      }
    },
    [createUpdate, toast],
  );

  useEffect(() => {
    // Read fresh state rather than the subscribed copy, so React's
    // double-invoked effects in development cannot start the same clip twice —
    // and twice would mean paying for it twice.
    const state = useTranscriptionQueue.getState();
    if (state.activeId) return;
    const next = state.items.find((item) => !item.error);
    if (!next) return;
    state.setActive(next.id);
    void process(next);
  }, [items, activeId, process]);

  // The audio only ever exists in memory, so leaving now loses it.
  useEffect(() => {
    if (items.length === 0) return;
    const warn = (event: BeforeUnloadEvent) => event.preventDefault();
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [items.length]);

  const failed = items.filter((item) => item.error);
  const waiting = items.length - failed.length;

  if (items.length === 0) return null;

  return (
    <div className="pointer-events-none fixed bottom-4 left-4 z-40 flex w-[min(22rem,calc(100vw-2rem))] flex-col gap-2">
      <AnimatePresence>
        {waiting > 0 && (
          <motion.div
            key="waiting"
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 12 }}
            transition={{ duration: 0.18 }}
            className="pointer-events-auto flex items-center gap-2.5 rounded-card border border-edge bg-surface-overlay px-3.5 py-2.5 text-sm shadow-lg"
          >
            <Loader2 className="h-4 w-4 shrink-0 animate-spin text-ink-muted" />
            <span className="text-ink-muted">
              Transcribing {waiting} {waiting === 1 ? "update" : "updates"}…
            </span>
          </motion.div>
        )}

        {failed.map((item) => (
          <motion.div
            key={item.id}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 12 }}
            transition={{ duration: 0.18 }}
            className="pointer-events-auto flex items-start gap-2.5 rounded-card border border-danger/30 bg-danger-soft px-3.5 py-2.5 text-sm text-danger shadow-lg"
          >
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
            <div className="flex-1">
              <p className="font-medium">{item.label}</p>
              <p className="text-xs opacity-80">{item.error}</p>
            </div>
            <button
              type="button"
              onClick={() => useTranscriptionQueue.getState().retry(item.id)}
              aria-label={`Retry ${item.label}`}
              title="Retry"
              className="shrink-0 opacity-70 transition-opacity hover:opacity-100"
            >
              <RotateCw className="h-4 w-4" />
            </button>
            <button
              type="button"
              onClick={() => useTranscriptionQueue.getState().remove(item.id)}
              aria-label={`Discard ${item.label}`}
              title="Discard — the recording is lost"
              className="shrink-0 opacity-70 transition-opacity hover:opacity-100"
            >
              <X className="h-4 w-4" />
            </button>
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
}
