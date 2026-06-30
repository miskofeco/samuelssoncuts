"use client";

import { useState, useTransition } from "react";
import Image from "next/image";

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
import { defaultServiceImage } from "@/domain/schedule";
import type { ActionResult } from "@/domain/types";
import { useT } from "@/i18n/provider";

type ServiceItem = {
  id: string;
  name: string;
  duration: number;
  price: number;
  imageUrl?: string | null;
  active: boolean;
  description: string | null;
};

type Draft = {
  id?: string;
  name: string;
  description: string;
  duration: string;
  price: string;
  imageUrl: string;
};

const emptyDraft: Draft = {
  name: "",
  description: "",
  duration: "45",
  price: "32",
  imageUrl: "",
};

export function ServiceManager({ services }: { services: ServiceItem[] }) {
  const t = useT();
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
      imageUrl: service.imageUrl ?? "",
    });
  }

  function save() {
    if (!draft) return;
    const payload = {
      name: draft.name,
      description: draft.description || undefined,
      durationMinutes: Number(draft.duration),
      priceCents: Math.round(Number(draft.price) * 100),
      imageUrl: draft.imageUrl || undefined,
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

  function imageIsExternal(src: string) {
    return src.startsWith("http");
  }

  return (
    <Card className="rounded-2xl p-5">
      <SectionHeader
        eyebrow={t.admin.catalogue}
        title={t.admin.services}
        action={<Button type="button" onClick={openCreate}>{t.admin.addService}</Button>}
      />

      <Feedback result={feedback} className="mt-4" />

      <div className="mt-4 space-y-2">
        {services.map((service) => (
          <div
            key={service.id}
            className="flex items-center justify-between gap-3 rounded-xl border border-black/10 bg-white p-3 dark:border-white/10 dark:bg-stone-900"
          >
            <span className="relative h-14 w-16 shrink-0 overflow-hidden rounded-lg">
              <Image
                src={defaultServiceImage(service)}
                alt=""
                fill
                sizes="64px"
                unoptimized={imageIsExternal(defaultServiceImage(service))}
                className="object-cover"
              />
            </span>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <p className="truncate font-semibold text-black dark:text-white">
                  {service.name}
                </p>
                {!service.active ? <StatusPill tone="neutral">{t.admin.hiddenLabel}</StatusPill> : null}
              </div>
              <p className="text-sm text-stone-500 dark:text-stone-400">
                {service.duration} {t.admin.minutesShort} · {service.price} €
              </p>
            </div>
            <div className="flex shrink-0 items-center gap-2">
              <Button type="button" variant="secondary" onClick={() => openEdit(service)}>
                {t.admin.edit}
              </Button>
              <Button
                type="button"
                variant="ghost"
                disabled={pending}
                onClick={() => toggle(service)}
              >
                {service.active ? t.admin.hide : t.admin.show}
              </Button>
            </div>
          </div>
        ))}
      </div>

      <Modal
        open={draft !== null}
        onClose={() => setDraft(null)}
        title={draft?.id ? t.admin.editService : t.admin.addService}
      >
        {draft ? (
          <div className="space-y-4">
            <Field
              label={t.admin.serviceName}
              value={draft.name}
              onChange={(event) => setDraft({ ...draft, name: event.target.value })}
            />
            <TextAreaField
              label={t.admin.serviceDescription}
              value={draft.description}
              onChange={(event) => setDraft({ ...draft, description: event.target.value })}
            />
            <div className="grid gap-3 sm:grid-cols-[96px_minmax(0,1fr)] sm:items-end">
              {(() => {
                const imageSrc = defaultServiceImage({
                  name: draft.name || emptyDraft.name,
                  imageUrl: draft.imageUrl,
                });
                return (
                  <span className="relative h-20 w-24 overflow-hidden rounded-lg">
                    <Image
                      src={imageSrc}
                      alt=""
                      fill
                      sizes="96px"
                      unoptimized={imageIsExternal(imageSrc)}
                      className="object-cover"
                    />
                  </span>
                );
              })()}
              <Field
                label={t.admin.serviceImage}
                value={draft.imageUrl}
                placeholder="/signature.jpg"
                onChange={(event) => setDraft({ ...draft, imageUrl: event.target.value })}
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <Field
                type="number"
                label={t.admin.serviceDuration}
                value={draft.duration}
                onChange={(event) => setDraft({ ...draft, duration: event.target.value })}
              />
              <Field
                type="number"
                label={t.admin.servicePrice}
                value={draft.price}
                onChange={(event) => setDraft({ ...draft, price: event.target.value })}
              />
            </div>
            <div className="flex justify-end gap-2">
              <Button type="button" variant="secondary" onClick={() => setDraft(null)}>
                {t.common.cancel}
              </Button>
              <Button type="button" onClick={save} disabled={pending}>
                {pending ? t.common.saving : t.common.save}
              </Button>
            </div>
          </div>
        ) : null}
      </Modal>
    </Card>
  );
}
