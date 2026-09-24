"use client";

import { useState, useTransition } from "react";

import { saveBookingContactAction } from "@/app/actions";
import { Button } from "@/components/shared/button";
import { Card, SectionHeader } from "@/components/shared/card";
import { Feedback } from "@/components/shared/feedback";
import { Field } from "@/components/shared/form";
import type { BookingContact } from "@/domain/shop-contact";
import type { ActionResult } from "@/domain/types";
import { useT } from "@/i18n/provider";

export function BookingContactForm({ initialContact }: { initialContact: BookingContact }) {
  const t = useT();
  const [contact, setContact] = useState(initialContact);
  const [pending, startTransition] = useTransition();
  const [feedback, setFeedback] = useState<ActionResult | null>(null);

  function save(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFeedback(null);
    startTransition(async () => {
      try {
        setFeedback(await saveBookingContactAction(contact));
      } catch {
        setFeedback({ ok: false, error: t.common.somethingWentWrong });
      }
    });
  }

  return (
    <Card className="rounded-2xl">
      <SectionHeader
        title={t.admin.bookingContactTitle}
        description={t.admin.bookingContactDescription}
      />
      <form onSubmit={save} className="mt-4 space-y-4">
        <Field
          label={t.admin.bookingAddress}
          autoComplete="street-address"
          maxLength={240}
          required
          value={contact.address}
          onChange={(event) => setContact({ ...contact, address: event.target.value })}
        />
        <Field
          label={t.admin.bookingPhone}
          type="tel"
          autoComplete="tel"
          inputMode="tel"
          maxLength={40}
          required
          value={contact.phone}
          onChange={(event) => setContact({ ...contact, phone: event.target.value })}
        />
        <Feedback result={feedback} />
        <Button type="submit" size="lg" loading={pending} className="w-full sm:w-auto">
          {pending ? t.common.saving : t.common.save}
        </Button>
      </form>
    </Card>
  );
}
