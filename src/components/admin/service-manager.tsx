"use client";

import { useState, useTransition } from "react";

import {
  createServiceAction,
  toggleServiceActiveAction,
  updateServiceAction,
} from "@/app/actions";
import { Button } from "@/components/shared/button";
import { Card, SectionHeader } from "@/components/shared/card";
import { Feedback } from "@/components/shared/feedback";
import { Field, TextAreaField } from "@/components/shared/form";
import { Modal } from "@/components/shared/modal";
import { StatusPill } from "@/components/shared/status-pill";
import type { ActionResult } from "@/domain/types";

type ServiceItem = {
  id: string;
  name: string;
  duration: number;
  price: number;
  active: boolean;
  description: string | null;
};

type Draft = {
  id?: string;
  name: string;
  description: string;
  duration: string;
  price: string;
};

const emptyDraft: Draft = { name: "", description: "", duration: "45", price: "32" };

export function ServiceManager({ services }: { services: ServiceItem[] }) {
  const [draft, setDraft] = useState<Draft | null>(null);
  const [pending, startTransition] = useTransition();
  const [feedback, setFeedback] = useState<ActionResult | null>(null);

  function openCreate() {
    setFeedback(null);
    setDraft({ ...emptyDraft });
  }

  function openEdit(service: ServiceItem) {
    setFeedback(null);
    setDraft({
      id: service.id,
      name: service.name,
      description: service.description ?? "",
      duration: String(service.duration),
      price: String(service.price),
    });
  }

  function save() {
    if (!draft) return;
    const payload = {
      name: draft.name,
      description: draft.description || undefined,
      durationMinutes: Number(draft.duration),
      priceCents: Math.round(Number(draft.price) * 100),
    };
    startTransition(async () => {
      const result = draft.id
        ? await updateServiceAction(draft.id, payload)
        : await createServiceAction(payload);
      setFeedback(result);
      if (result.ok) setDraft(null);
    });
  }

  function toggle(service: ServiceItem) {
    startTransition(async () => {
      setFeedback(await toggleServiceActiveAction(service.id, !service.active));
    });
  }

  return (
    <Card className="rounded-2xl p-5">
      <SectionHeader
        eyebrow="Catalogue"
        title="Services"
        action={<Button type="button" onClick={openCreate}>Add service</Button>}
      />

      <Feedback result={feedback} className="mt-4" />

      <div className="mt-4 space-y-2">
        {services.map((service) => (
          <div
            key={service.id}
            className="flex items-center justify-between gap-3 rounded-xl border border-black/10 bg-white p-3 dark:border-white/10 dark:bg-stone-900"
          >
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <p className="truncate font-semibold text-black dark:text-white">
                  {service.name}
                </p>
                {!service.active ? <StatusPill tone="neutral">Hidden</StatusPill> : null}
              </div>
              <p className="text-sm text-stone-500 dark:text-stone-400">
                {service.duration} min · ${service.price}
              </p>
            </div>
            <div className="flex shrink-0 items-center gap-2">
              <Button type="button" variant="secondary" onClick={() => openEdit(service)}>
                Edit
              </Button>
              <Button
                type="button"
                variant="ghost"
                disabled={pending}
                onClick={() => toggle(service)}
              >
                {service.active ? "Hide" : "Show"}
              </Button>
            </div>
          </div>
        ))}
      </div>

      <Modal
        open={draft !== null}
        onClose={() => setDraft(null)}
        title={draft?.id ? "Edit service" : "New service"}
      >
        {draft ? (
          <div className="space-y-4">
            <Field
              label="Name"
              value={draft.name}
              onChange={(event) => setDraft({ ...draft, name: event.target.value })}
            />
            <TextAreaField
              label="Description"
              value={draft.description}
              onChange={(event) => setDraft({ ...draft, description: event.target.value })}
            />
            <div className="grid grid-cols-2 gap-3">
              <Field
                type="number"
                label="Duration (min)"
                value={draft.duration}
                onChange={(event) => setDraft({ ...draft, duration: event.target.value })}
              />
              <Field
                type="number"
                label="Price ($)"
                value={draft.price}
                onChange={(event) => setDraft({ ...draft, price: event.target.value })}
              />
            </div>
            <div className="flex justify-end gap-2">
              <Button type="button" variant="secondary" onClick={() => setDraft(null)}>
                Cancel
              </Button>
              <Button type="button" onClick={save} disabled={pending}>
                {pending ? "Saving…" : "Save"}
              </Button>
            </div>
          </div>
        ) : null}
      </Modal>
    </Card>
  );
}
