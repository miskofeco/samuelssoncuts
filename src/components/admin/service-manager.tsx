"use client";

import { useRef, useState, useTransition } from "react";
import Image from "next/image";

import {
  createServiceAction,
  toggleServiceActiveAction,
  updateServiceAction,
  uploadServiceImageAction,
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

const IMAGE_ACCEPT = "image/jpeg,image/png,image/webp";

function ServiceImageLabel({ label }: { label: string }) {
  return (
    <span className="mb-2 block text-sm font-medium text-stone-700 dark:text-stone-300">
      {label}
    </span>
  );
}

export function ServiceManager({ services }: { services: ServiceItem[] }) {
  const t = useT();
  const [draft, setDraft] = useState<Draft | null>(null);
  const [pending, startTransition] = useTransition();
  const [feedback, setFeedback] = useState<ActionResult | null>(null);

  // Local preview while a file is picked but not yet uploaded.
  const [localPreview, setLocalPreview] = useState<string | null>(null);
  const [pendingFile, setPendingFile] = useState<File | null>(null);
  const [uploadPending, startUploadTransition] = useTransition();
  const [uploadFeedback, setUploadFeedback] = useState<ActionResult | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  function openCreate() {
    setFeedback(null);
    setUploadFeedback(null);
    setLocalPreview(null);
    setPendingFile(null);
    setDraft({ ...emptyDraft });
  }

  function openEdit(service: ServiceItem) {
    setFeedback(null);
    setUploadFeedback(null);
    setLocalPreview(null);
    setPendingFile(null);
    setDraft({
      id: service.id,
      name: service.name,
      description: service.description ?? "",
      duration: String(service.duration),
      price: String(service.price),
      imageUrl: service.imageUrl ?? "",
    });
  }

  function onClose() {
    setDraft(null);
    setLocalPreview(null);
    setPendingFile(null);
    setUploadFeedback(null);
  }

  function onPickFile(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;

    // Show local preview immediately; upload happens on save (or right away if editing).
    const objectUrl = URL.createObjectURL(file);
    setLocalPreview(objectUrl);
    setPendingFile(file);
    setUploadFeedback(null);

    // If editing an existing service, upload immediately.
    if (draft?.id) {
      const data = new FormData();
      data.set("file", file);
      startUploadTransition(async () => {
        const result = await uploadServiceImageAction(draft.id!, data);
        setUploadFeedback(result);
        if (result.ok && "url" in result && typeof result.url === "string") {
          setDraft((prev) => prev ? { ...prev, imageUrl: result.url as string } : prev);
          setLocalPreview(null);
          setPendingFile(null);
        }
      });
    }
  }

  async function save() {
    if (!draft) return;
    const payload = {
      name: draft.name,
      description: draft.description || undefined,
      durationMinutes: Number(draft.duration),
      priceCents: Math.round(Number(draft.price) * 100),
      imageUrl: draft.imageUrl || undefined,
    };
    startTransition(async () => {
      let serviceId = draft.id;

      const result = serviceId
        ? await updateServiceAction(serviceId, payload)
        : await createServiceAction(payload);

      setFeedback(result);

      if (!result.ok) return;

      // For new services, get the assigned ID back so we can upload the image.
      if (!serviceId && "id" in result && typeof result.id === "string") {
        serviceId = result.id;
      }

      // Upload a pending file if one was picked before saving.
      if (pendingFile && serviceId) {
        const data = new FormData();
        data.set("file", pendingFile);
        const uploadResult = await uploadServiceImageAction(serviceId, data);
        setUploadFeedback(uploadResult);
      }

      onClose();
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

  // The image to show in the modal: local preview > uploaded imageUrl > default.
  function modalImageSrc() {
    if (localPreview) return localPreview;
    return defaultServiceImage({
      name: draft?.name || emptyDraft.name,
      imageUrl: draft?.imageUrl,
    });
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
        {services.map((service) => {
          const imageSrc = defaultServiceImage(service);
          return (
            <div
              key={service.id}
              className="flex items-center gap-3 rounded-xl border border-black/10 bg-white p-3 dark:border-white/10 dark:bg-stone-900"
            >
              <span className="relative h-20 w-20 shrink-0 overflow-hidden rounded-xl">
                <Image
                  src={imageSrc}
                  alt=""
                  fill
                  sizes="80px"
                  unoptimized={imageIsExternal(imageSrc)}
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
                <div className="mt-2 flex gap-2">
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
            </div>
          );
        })}
      </div>

      <Modal
        open={draft !== null}
        onClose={onClose}
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

            {/* Image upload */}
            <div>
              <ServiceImageLabel label={t.admin.serviceImage} />
              <div className="flex items-end gap-4">
                <span className="relative h-24 w-28 shrink-0 overflow-hidden rounded-xl border border-black/10 dark:border-white/10">
                  <Image
                    src={modalImageSrc()}
                    alt=""
                    fill
                    sizes="112px"
                    unoptimized={localPreview != null || imageIsExternal(modalImageSrc())}
                    className="object-cover"
                  />
                  {uploadPending ? (
                    <span className="absolute inset-0 flex items-center justify-center bg-black/40">
                      <span className="h-5 w-5 animate-spin rounded-full border-2 border-white border-t-transparent" />
                    </span>
                  ) : null}
                </span>
                <div className="min-w-0 space-y-2">
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept={IMAGE_ACCEPT}
                    className="sr-only"
                    onChange={onPickFile}
                  />
                  <Button
                    type="button"
                    variant="secondary"
                    disabled={uploadPending}
                    onClick={() => fileInputRef.current?.click()}
                  >
                    {uploadPending ? t.profile.uploading : t.profile.changePhoto}
                  </Button>
                  <p className="text-xs text-stone-400 dark:text-stone-500">
                    JPG, PNG, WebP · max 3 MB
                  </p>
                </div>
              </div>
              {uploadFeedback && !uploadFeedback.ok ? (
                <p className="mt-2 text-xs text-red-600 dark:text-red-400">{uploadFeedback.error}</p>
              ) : null}
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
            <Feedback result={feedback && !feedback.ok ? feedback : null} />
            <div className="flex justify-end gap-2">
              <Button type="button" variant="secondary" onClick={onClose}>
                {t.common.cancel}
              </Button>
              <Button type="button" onClick={save} disabled={pending || uploadPending}>
                {pending ? t.common.saving : t.common.save}
              </Button>
            </div>
          </div>
        ) : null}
      </Modal>
    </Card>
  );
}
