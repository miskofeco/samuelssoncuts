"use client";

import { useRouter } from "next/navigation";
import type { ChangeEvent, FormEvent } from "react";
import { useRef, useState, useTransition } from "react";

import { removeAvatarAction, updateProfileAction, uploadAvatarAction } from "@/app/actions";
import { Avatar } from "@/components/shared/avatar";
import { Button } from "@/components/shared/button";
import { Card, SectionHeader } from "@/components/shared/card";
import { Feedback } from "@/components/shared/feedback";
import { Field } from "@/components/shared/form";
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
  const router = useRouter();
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
        if (result.ok) router.refresh();
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
        if (result.ok) router.refresh();
      } catch {
        setPhotoFeedback({ ok: false, error: t.common.somethingWentWrong });
      }
    });
  }

  return (
    <Card className="rounded-2xl p-5">
      <SectionHeader eyebrow={t.profile.eyebrow} title={t.profile.title} />

      {/* Profile picture */}
      <div className="mt-4 flex items-center gap-4">
        <Avatar name={name} src={avatarUrl} size="lg" className="h-16 w-16 text-base" />
        <div className="min-w-0">
          <p className="text-sm font-medium text-stone-700 dark:text-stone-300">
            {t.profile.photo}
          </p>
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
              disabled={photoPending}
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
                disabled={photoPending}
                onClick={onRemove}
                className="text-red-600 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-500/10"
              >
                {t.profile.removePhoto}
              </Button>
            ) : null}
          </div>
          <p className="mt-1.5 text-xs text-stone-400 dark:text-stone-500">
            {t.profile.photoHint}
          </p>
        </div>
      </div>
      <Feedback result={photoFeedback} className="mt-3" />

      <form onSubmit={onSubmit} className="mt-5 space-y-4">
        <Field
          label={t.common.email}
          value={email}
          disabled
          readOnly
          className="opacity-70"
        />
        <Field
          required
          label={t.common.fullName}
          value={name}
          onChange={(event) => setName(event.target.value)}
        />
        <Field
          required
          label={t.common.phone}
          value={phoneValue}
          onChange={(event) => setPhoneValue(event.target.value)}
        />
        <Feedback result={feedback} />
        <Button type="submit" disabled={pending}>
          {pending ? t.common.saving : t.common.save}
        </Button>
      </form>
    </Card>
  );
}
