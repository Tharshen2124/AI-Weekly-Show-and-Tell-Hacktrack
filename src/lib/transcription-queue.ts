import { create } from "zustand";
import { Id } from "../../convex/_generated/dataModel";

export interface QueuedUpdate {
  id: string;
  memberId: Id<"members">;
  projectId: Id<"projects">;
  meetupId: Id<"meetups">;
  /** "Ali · Rocket" — lets the scribe tell queued items apart in the tray. */
  label: string;
  blob: Blob;
  extension: string;
  /** Set when transcribing or saving failed; the item then waits for a retry. */
  error: string | null;
}

interface TranscriptionQueue {
  items: QueuedUpdate[];
  /** The item being worked on, so exactly one is in flight at a time. */
  activeId: string | null;
  enqueue: (item: Omit<QueuedUpdate, "id" | "error">) => void;
  setActive: (id: string | null) => void;
  fail: (id: string, error: string) => void;
  retry: (id: string) => void;
  remove: (id: string) => void;
}

/**
 * Holds recordings waiting to become updates.
 *
 * Lives outside React so it survives navigation between dashboard pages while
 * the scribe moves on to the next person. The audio is only ever in memory, so
 * a reload loses whatever has not finished — `TranscriptionQueueTray` warns
 * before that can happen.
 */
export const useTranscriptionQueue = create<TranscriptionQueue>((set) => ({
  items: [],
  activeId: null,

  enqueue: (item) =>
    set((state) => ({
      items: [...state.items, { ...item, id: crypto.randomUUID(), error: null }],
    })),

  setActive: (id) => set({ activeId: id }),

  fail: (id, error) =>
    set((state) => ({
      items: state.items.map((item) => (item.id === id ? { ...item, error } : item)),
    })),

  retry: (id) =>
    set((state) => ({
      items: state.items.map((item) => (item.id === id ? { ...item, error: null } : item)),
    })),

  remove: (id) =>
    set((state) => ({
      items: state.items.filter((item) => item.id !== id),
    })),
}));
