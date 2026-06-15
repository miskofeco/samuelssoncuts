"use client";

import { useRouter } from "next/navigation";
import type { FormEvent } from "react";
import { useState, useTransition } from "react";

import { completePhoneAction } from "@/app/actions";
import { Button } from "@/components/shared/button";
import { Feedback } from "@/components/shared/feedback";
import { Field } from "@/components/shared/form";
import type { ActionResult } from "@/domain/types";
import { useT } from "@/i18n/provider";

export function CompletePhoneForm() {
  const t = useT();
  const router = useRouter();
  const [phone, setPhone] = useState("");
  const [pending, startTransition] = useTransition();
  const [feedback, setFeedback] = useState<ActionResult | null>(null);

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFeedback(null);
    startTransition(async () => {
      const result = await completePhoneAction({ phone });
      if (result.ok) {
        // Phone saved — the gate now lets them through.
        router.replace("/dashboard");
        return;
      }
      setFeedback(result);
    });
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <Field
        required
        label={t.common.phone}
        name="phone"
        value={phone}
        onChange={(event) => setPhone(event.target.value)}
        placeholder={t.auth.phonePlaceholder}
      />
      <Feedback result={feedback} />
      <Button type="submit" className="w-full" disabled={pending}>
        {pending ? t.common.saving : t.auth.completeProfileCta}
      </Button>
    </form>
  );
}
