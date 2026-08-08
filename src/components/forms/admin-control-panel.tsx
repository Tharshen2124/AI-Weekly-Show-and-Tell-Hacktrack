"use client";

import { useState } from "react";
import { CalendarPlus, FolderPlus, MessageSquarePlus, UserPlus } from "lucide-react";
import { useIsAdmin } from "@/lib/use-access";
import { ModalLayout } from "@/components/ui/modal-layout";
import { MeetupFormModal } from "./meetup-form-modal";
import { MemberForm } from "./member-form";
import { ProjectFormModal } from "./project-form-modal";
import { UpdateFormModal } from "./update-form-modal";

export function AdminControlPanel() {
  const isAdmin = useIsAdmin();
  const [openModal, setOpenModal] = useState<
    "meetup" | "member" | "project" | "update" | null
  >(null);

  if (!isAdmin) return null;

  const actions = [
    { key: "meetup" as const, label: "New Meetup", icon: CalendarPlus },
    { key: "member" as const, label: "New Member", icon: UserPlus },
    { key: "project" as const, label: "New Project", icon: FolderPlus },
    { key: "update" as const, label: "New Update", icon: MessageSquarePlus },
  ];

  return (
    <section aria-label="Admin control panel">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {actions.map(({ key, label, icon: Icon }) => (
          <button
            key={key}
            onClick={() => setOpenModal(key)}
            className="group flex items-center gap-3 rounded-card border border-edge bg-surface-raised px-5 py-4 text-left transition-all hover:-translate-y-0.5 hover:border-edge-strong hover:shadow-md"
          >
            <span className="rounded-card bg-accent p-2.5 text-on-accent">
              <Icon className="h-5 w-5" />
            </span>
            <span className="font-medium">{label}</span>
          </button>
        ))}
      </div>
      <MeetupFormModal open={openModal === "meetup"} onClose={() => setOpenModal(null)} />
      <ModalLayout
        open={openModal === "member"}
        onClose={() => setOpenModal(null)}
        title="New Member"
        wide
      >
        {/* Mounted only while open, so state resets every time the modal reopens. */}
        {openModal === "member" && (
          <MemberForm onSaved={() => setOpenModal(null)} onCancel={() => setOpenModal(null)} />
        )}
      </ModalLayout>
      <ProjectFormModal open={openModal === "project"} onClose={() => setOpenModal(null)} />
      <UpdateFormModal open={openModal === "update"} onClose={() => setOpenModal(null)} />
    </section>
  );
}
