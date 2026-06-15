"use client";

import type { FormEvent } from "react";
import { useState, useTransition } from "react";

import { updateProfileAction } from "@/app/actions";
import { Button } from "@/components/shared/button";
import { Card, SectionHeader } from "@/components/shared/card";
import { Feedback } from "@/components/shared/feedback";
import { Field } from "@/components/shared/form";
import type { ActionResult } from "@/domain/types";

export function ProfileForm({
  fullName,
  phone,
  email,
}: {
  fullName: string;
  phone: string;
  email: string;
}) {
  const [name, setName] = useState(fullName);
  const [phoneValue, setPhoneValue] = useState(phone);
  const [pending, startTransition] = useTransition();
  const [feedback, setFeedback] = useState<ActionResult | null>(null);

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFeedback(null);
    startTransition(async () => {
      setFeedback(await updateProfileAction({ fullName: name, phone: phoneValue }));
    });
  }

  return (
    <Card className="rounded-2xl p-5">
      <SectionHeader eyebrow="Account" title="Your details" />
      <form onSubmit={onSubmit} className="mt-4 space-y-4">
        <Field
          label="Email"
          value={email}
          disabled
          readOnly
          className="opacity-70"
        />
        <Field
          required
          label="Full name"
          value={name}
          onChange={(event) => setName(event.target.value)}
        />
        <Field
          required
          label="Phone"
          value={phoneValue}
          onChange={(event) => setPhoneValue(event.target.value)}
        />
        <Feedback result={feedback} />
        <Button type="submit" disabled={pending}>
          {pending ? "Saving…" : "Save changes"}
        </Button>
      </form>
    </Card>
  );
}
