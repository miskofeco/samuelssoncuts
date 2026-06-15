"use client";

import type { FormEvent } from "react";
import { useState, useTransition } from "react";

import { createRequestFromClientAction } from "@/app/actions";
import { Button } from "@/components/shared/button";
import { Card, SectionHeader } from "@/components/shared/card";
import { Feedback } from "@/components/shared/feedback";
import { SelectField, TextAreaField } from "@/components/shared/form";
import { addDays } from "@/domain/schedule";
import type {
  ActionResult,
  AppState,
  DayWindow,
  Preference,
} from "@/domain/types";

import { PreferencePicker } from "./preference-picker";

// First N future days that are not blocked — used to seed sensible defaults.
function firstOpenDays(blockedDates: ReadonlySet<string>, count: number) {
  const days: string[] = [];
  for (let offset = 1; days.length < count && offset < 120; offset += 1) {
    const date = addDays(offset);
    if (!blockedDates.has(date)) days.push(date);
  }
  return days;
}

export function RequestForm({
  state,
  blockedDates,
}: {
  state: AppState;
  blockedDates: ReadonlySet<string>;
}) {
  const [serviceId, setServiceId] = useState(state.services[0]?.id ?? "");
  const [note, setNote] = useState("");
  const [pending, startTransition] = useTransition();
  const [feedback, setFeedback] = useState<ActionResult | null>(null);
  const [preferences, setPreferences] = useState<Preference[]>(() => {
    const [d1, d2, d3] = firstOpenDays(blockedDates, 3);
    const windows: DayWindow[] = ["Afternoon", "Morning", "Evening"];
    return [d1, d2, d3].map((date, index) => ({
      id: `p${index + 1}`,
      rank: index + 1,
      date: date ?? addDays(index + 1),
      window: windows[index],
    }));
  });

  function updatePreferenceDate(rank: number, date: string) {
    if (blockedDates.has(date)) return;
    setPreferences((current) =>
      current.map((preference) =>
        preference.rank === rank ? { ...preference, date } : preference,
      ),
    );
  }

  function updatePreferenceWindow(rank: number, window: DayWindow) {
    setPreferences((current) =>
      current.map((preference) =>
        preference.rank === rank ? { ...preference, window } : preference,
      ),
    );
  }

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFeedback(null);
    startTransition(async () => {
      const result = await createRequestFromClientAction(serviceId, preferences, note);
      setFeedback(result);
      if (result.ok) setNote("");
    });
  }

  return (
    <Card className="rounded-2xl p-3 sm:p-5">
      <form onSubmit={onSubmit}>
        <SectionHeader
          eyebrow="New appointment"
          title="Pick three preferred days"
          action={
            <SelectField
              aria-label="Service"
              label="Service"
              value={serviceId}
              onChange={(event) => setServiceId(event.target.value)}
              className="min-w-[220px]"
            >
              {state.services.map((service) => (
                <option key={service.id} value={service.id}>
                  {service.name} — {service.duration} min · ${service.price}
                </option>
              ))}
            </SelectField>
          }
        />

        <div className="mt-4">
          <PreferencePicker
            preferences={preferences}
            state={state}
            blockedDates={blockedDates}
            updatePreferenceDate={updatePreferenceDate}
            updatePreferenceWindow={updatePreferenceWindow}
          />
        </div>

        <TextAreaField
          label="Notes"
          value={note}
          onChange={(event) => setNote(event.target.value)}
          placeholder="Anything the barber should know?"
          className="mt-4"
        />

        <Feedback result={feedback} className="mt-4" />

        <Button
          type="submit"
          disabled={!serviceId || pending}
          className="mt-4 w-full sm:w-auto"
        >
          {pending
            ? "Sending…"
            : serviceId
              ? "Send request"
              : "No services configured"}
        </Button>
      </form>
    </Card>
  );
}
