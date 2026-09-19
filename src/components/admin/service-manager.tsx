"use client";

import { Add01Icon, Camera01Icon, PencilEdit01Icon, Scissor01Icon } from "@hugeicons/core-free-icons";
import { useEffect, useRef, useState, useTransition } from "react";
import type { FormEvent } from "react";
import Image from "next/image";

import {
  createServiceAction,
  toggleServiceActiveAction,
  updateServiceAction,
  uploadServiceImageAction,
} from "@/app/actions";
import { Button } from "@/components/shared/button";
import { Card, SectionHeader } from "@/components/shared/card";
import { EmptyState } from "@/components/shared/empty-state";
import { Feedback } from "@/components/shared/feedback";
import { Field, TextAreaField } from "@/components/shared/form";
import { Icon } from "@/components/shared/icon";
import { Modal } from "@/components/shared/modal";
import { StatusPill } from "@/components/shared/status-pill";
import { Toggle } from "@/components/shared/toggle";
import { Spinner } from "@/components/ui/spinner";
import { defaultServiceImage } from "@/domain/schedule";
import type { ActionResult } from "@/domain/types";
import { useT } from "@/i18n/provider";
import { cn } from "@/lib/classnames";

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
  return <span className="mb-1.5 block text-sm font-medium text-foreground">{label}</span>;
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

  // Release the previous object URL whenever the preview changes or unmounts.
  useEffect(() => {
    if (!localPreview) return;
    return () => URL.revokeObjectURL(localPreview);
  }, [localPreview]);

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
        try {
          const result = await uploadServiceImageAction(draft.id!, data);
          setUploadFeedback(result);
          if (result.ok && "url" in result && typeof result.url === "string") {
            setDraft((prev) => prev ? { ...prev, imageUrl: result.url as string } : prev);
            setLocalPreview(null);
            setPendingFile(null);
          }
        } catch {
          setUploadFeedback({ ok: false, error: t.common.somethingWentWrong });
        }
      });
    }
  }

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!draft) return;
    const payload = {
      name: draft.name,
      description: draft.description || undefined,
      durationMinutes: Number(draft.duration),
      priceCents: Math.round(Number(draft.price) * 100),
      imageUrl: draft.imageUrl || undefined,
    };
    startTransition(async () => {
      try {
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

        // Upload a pending file if one was picked before saving. If the image
        // upload fails, keep the modal open and surface the error — the service
        // itself saved fine, but silently closing would hide the failed image.
        if (pendingFile && serviceId) {
          const data = new FormData();
          data.set("file", pendingFile);
          const uploadResult = await uploadServiceImageAction(serviceId, data);
          setUploadFeedback(uploadResult);
          if (!uploadResult.ok) return;
        }

        onClose();
      } catch {
        setFeedback({ ok: false, error: t.common.somethingWentWrong });
      }
    });
  }

  function toggle(service: ServiceItem) {
    startTransition(async () => {
      try {
        setFeedback(await toggleServiceActiveAction(service.id, !service.active));
      } catch {
        setFeedback({ ok: false, error: t.common.somethingWentWrong });
      }
    });
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
    <Card className="rounded-2xl">
      <SectionHeader
        eyebrow={t.admin.catalogue}
        title={t.admin.services}
        action={
          <Button type="button" onClick={openCreate} className="w-full sm:w-auto">
            <Icon icon={Add01Icon} strokeWidth={2.2} />
            {t.admin.addService}
          </Button>
        }
      />

      <Feedback result={feedback} className="mt-4" />

      {services.length === 0 ? (
        <EmptyState
          className="mt-4"
          title={t.admin.services}
          icon={<Icon icon={Scissor01Icon} />}
          action={
            <Button type="button" variant="secondary" onClick={openCreate}>
              <Icon icon={Add01Icon} strokeWidth={2.2} />
              {t.admin.addService}
            </Button>
          }
        />
      ) : (
        <ul className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-1 2xl:grid-cols-2">
          {services.map((service) => {
            const imageSrc = defaultServiceImage(service);
            return (
              <li
                key={service.id}
                className={cn(
                  "flex gap-3 rounded-xl bg-card p-3 ring-1 ring-foreground/10 transition",
                  !service.active && "opacity-80",
                )}
              >
                <span className="relative size-24 shrink-0 overflow-hidden rounded-lg bg-muted sm:size-28">
                  <Image
                    src={imageSrc}
                    alt=""
                    fill
                    sizes="112px"
                    className={cn("object-cover", !service.active && "grayscale")}
                  />
                </span>
                <div className="flex min-w-0 flex-1 flex-col">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="truncate font-semibold text-foreground">{service.name}</p>
                      <p className="text-sm text-muted-foreground tabular-nums">
                        {service.duration} {t.admin.minutesShort} · {service.price} €
                      </p>
                    </div>
                    {!service.active ? <StatusPill tone="neutral">{t.admin.hiddenLabel}</StatusPill> : null}
                  </div>
                  {service.description ? (
                    <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">{service.description}</p>
                  ) : null}
                  <div className="mt-auto flex items-center justify-between gap-2 pt-2">
                    <label className="flex min-h-10 items-center gap-2 text-xs font-medium text-muted-foreground">
                      <Toggle
                        size="sm"
                        checked={service.active}
                        disabled={pending}
                        onChange={() => toggle(service)}
                        label={`${service.name}: ${t.admin.serviceVisible}`}
                      />
                      <span className="hidden sm:inline">{t.admin.serviceVisible}</span>
                    </label>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => openEdit(service)}
                      className="h-9"
                    >
                      <Icon icon={PencilEdit01Icon} />
                      {t.admin.edit}
                    </Button>
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      )}

      <Modal
        open={draft !== null}
        onClose={onClose}
        title={draft?.id ? t.admin.editService : t.admin.addService}
      >
        {draft ? (
          <form className="space-y-4" onSubmit={save}>
            {/* Image upload */}
            <div>
              <ServiceImageLabel label={t.admin.serviceImage} />
              <div className="flex items-center gap-4">
                <span className="relative size-24 shrink-0 overflow-hidden rounded-xl bg-muted ring-1 ring-foreground/10 sm:h-24 sm:w-32">
                  <Image
                    src={modalImageSrc()}
                    alt=""
                    fill
                    sizes="128px"
                    unoptimized={localPreview != null}
                    className="object-cover"
                  />
                  {uploadPending ? (
                    <span className="absolute inset-0 flex items-center justify-center bg-black/40 text-white">
                      <Spinner className="size-5" />
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
                    variant="outline"
                    disabled={uploadPending}
                    onClick={() => fileInputRef.current?.click()}
                  >
                    <Icon icon={Camera01Icon} />
                    {uploadPending ? t.profile.uploading : t.profile.changePhoto}
                  </Button>
                  <p className="text-xs text-muted-foreground">{t.admin.serviceImageHint}</p>
                </div>
              </div>
              {uploadFeedback && !uploadFeedback.ok ? (
                <p className="mt-2 text-xs font-medium text-destructive">{uploadFeedback.error}</p>
              ) : null}
            </div>

            <Field
              label={t.admin.serviceName}
              value={draft.name}
              onChange={(event) => setDraft({ ...draft, name: event.target.value })}
              autoComplete="off"
            />
            <TextAreaField
              label={t.admin.serviceDescription}
              value={draft.description}
              onChange={(event) => setDraft({ ...draft, description: event.target.value })}
            />

            <div className="grid grid-cols-2 gap-3">
              <Field
                type="number"
                inputMode="numeric"
                min={15}
                max={480}
                step={15}
                label={t.admin.serviceDuration}
                value={draft.duration}
                onChange={(event) => setDraft({ ...draft, duration: event.target.value })}
              />
              <Field
                type="number"
                inputMode="decimal"
                min={0}
                max={1000}
                step={0.5}
                label={t.admin.servicePrice}
                value={draft.price}
                onChange={(event) => setDraft({ ...draft, price: event.target.value })}
              />
            </div>
            <Feedback result={feedback && !feedback.ok ? feedback : null} />
            <div className="flex flex-col-reverse gap-2 border-t pt-4 sm:flex-row sm:justify-end">
              <Button type="button" variant="outline" size="lg" onClick={onClose}>
                {t.common.cancel}
              </Button>
              <Button
                type="submit"
                size="lg"
                loading={pending}
                disabled={uploadPending || draft.name.trim().length === 0}
              >
                {pending ? t.common.saving : t.common.save}
              </Button>
            </div>
          </form>
        ) : null}
      </Modal>
    </Card>
  );
}
