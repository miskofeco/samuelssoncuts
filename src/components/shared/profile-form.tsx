"use client";

import { Camera01Icon, Delete02Icon } from "@hugeicons/core-free-icons";
import type { ChangeEvent, FormEvent } from "react";
import { useRef, useState, useTransition } from "react";

import { removeAvatarAction, updateProfileAction, uploadAvatarAction } from "@/app/actions";
import { Avatar } from "@/components/shared/avatar";
import { Button } from "@/components/shared/button";
import { Card, SectionHeader } from "@/components/shared/card";
import { Feedback } from "@/components/shared/feedback";
import { Field } from "@/components/shared/form";
import { Icon } from "@/components/shared/icon";
import { Separator } from "@/components/ui/separator";
import type { ActionResult } from "@/domain/types";
import { useT } from "@/i18n/provider";

export function ProfileForm({
  fullName,
  phone,
  email,
  avatarUrl,
}: {
  fullName: string;
  phone: string;
  email: string;
  avatarUrl?: string | null;
}) {
  const t = useT();
  const [name, setName] = useState(fullName);
  const [phoneValue, setPhoneValue] = useState(phone);
  const [pending, startTransition] = useTransition();
  const [feedback, setFeedback] = useState<ActionResult | null>(null);

  const fileInput = useRef<HTMLInputElement>(null);
  const [photoPending, startPhotoTransition] = useTransition();
  const [photoFeedback, setPhotoFeedback] = useState<ActionResult | null>(null);

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFeedback(null);
    startTransition(async () => {
      try {
        setFeedback(await updateProfileAction({ fullName: name, phone: phoneValue }));
      } catch {
        setFeedback({ ok: false, error: t.common.somethingWentWrong });
      }
    });
  }

  function onPickFile(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    // Reset the input so picking the same file again still fires onChange.
    event.target.value = "";
    if (!file) return;
    const data = new FormData();
    data.set("file", file);
    setPhotoFeedback(null);
    startPhotoTransition(async () => {
      try {
        const result = await uploadAvatarAction(data);
        setPhotoFeedback(result);
      } catch {
        setPhotoFeedback({ ok: false, error: t.common.somethingWentWrong });
      }
    });
  }

  function onRemove() {
    setPhotoFeedback(null);
    startPhotoTransition(async () => {
      try {
        const result = await removeAvatarAction();
        setPhotoFeedback(result);
      } catch {
        setPhotoFeedback({ ok: false, error: t.common.somethingWentWrong });
      }
    });
  }

  return (
    <Card className="rounded-2xl">
      <SectionHeader eyebrow={t.profile.eyebrow} title={t.profile.title} />

      {/* Profile picture */}
      <div className="mt-5 flex items-center gap-4">
        <div className="relative shrink-0">
          <Avatar name={name} src={avatarUrl} size="xl" />
          <button
            type="button"
            aria-label={avatarUrl ? t.profile.changePhoto : t.profile.uploadPhoto}
            disabled={photoPending}
            onClick={() => fileInput.current?.click()}
            className="absolute -right-1 -bottom-1 flex size-8 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-xs ring-2 ring-card outline-none transition hover:opacity-90 focus-visible:ring-3 focus-visible:ring-ring/50 disabled:opacity-60"
          >
            <Icon icon={Camera01Icon} className="size-4" strokeWidth={2} />
          </button>
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-foreground">{t.profile.photo}</p>
          <p className="mt-0.5 text-xs text-muted-foreground">{t.profile.photoHint}</p>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <input
              ref={fileInput}
              type="file"
              accept="image/jpeg,image/png,image/webp"
              onChange={onPickFile}
              className="hidden"
            />
            <Button
              type="button"
              variant="secondary"
              size="sm"
              disabled={photoPending}
              loading={photoPending}
              onClick={() => fileInput.current?.click()}
            >
              {photoPending
                ? t.profile.uploading
                : avatarUrl
                  ? t.profile.changePhoto
                  : t.profile.uploadPhoto}
            </Button>
            {avatarUrl ? (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                disabled={photoPending}
                onClick={onRemove}
                className="text-destructive hover:bg-destructive/10 hover:text-destructive"
              >
                <Icon icon={Delete02Icon} className="size-3.5" />
                {t.profile.removePhoto}
              </Button>
            ) : null}
          </div>
        </div>
      </div>
      <Feedback result={photoFeedback} className="mt-3" />

      <Separator className="my-5" />

      <form onSubmit={onSubmit} className="space-y-4">
        <Field
          label={t.common.email}
          value={email}
          disabled
          readOnly
          autoComplete="email"
        />
        <Field
          required
          label={t.common.fullName}
          value={name}
          autoComplete="name"
          onChange={(event) => setName(event.target.value)}
        />
        <Field
          required
          label={t.common.phone}
          value={phoneValue}
          type="tel"
          inputMode="tel"
          autoComplete="tel"
          onChange={(event) => setPhoneValue(event.target.value)}
        />
        <Feedback result={feedback} />
        <Button type="submit" size="lg" loading={pending} className="w-full sm:w-auto sm:h-10 sm:text-sm">
          {pending ? t.common.saving : t.common.save}
        </Button>
      </form>
    </Card>
  );
}
