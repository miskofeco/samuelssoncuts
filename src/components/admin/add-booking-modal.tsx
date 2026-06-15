"use client";

import { useState, useTransition } from "react";

import { createAdminBookingAction } from "@/app/actions";
import { Button } from "@/components/shared/button";
import { Combobox } from "@/components/shared/combobox";
import { Feedback } from "@/components/shared/feedback";
import { Field, SelectField } from "@/components/shared/form";
import { Modal } from "@/components/shared/modal";
import { SegmentedControl } from "@/components/shared/segmented-control";
import { workingHoursQuarterly } from "@/domain/schedule";
import type { ActionResult, ClientProfile, Service } from "@/domain/types";

type CustomerMode = "client" | "walkin";

export function AddBookingModal({
  open,
  onClose,
  clients,
  services,
  initialDate,
  initialTime,
}: {
  open: boolean;
  onClose: () => void;
  clients: ClientProfile[];
  services: Service[];
  initialDate?: string;
  initialTime?: string;
}) {
  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Add booking"
      description="Book an existing client or a walk-in. The slot is reserved immediately."
    >
      {/* Remount per slot so the form re-seeds from initialDate/initialTime
          without a setState-in-effect. */}
      <BookingForm
        key={`${initialDate ?? ""}-${initialTime ?? ""}`}
        clients={clients}
        services={services}
        initialDate={initialDate}
        initialTime={initialTime}
        onClose={onClose}
      />
    </Modal>
  );
}

function BookingForm({
  clients,
  services,
  initialDate,
  initialTime,
  onClose,
}: {
  clients: ClientProfile[];
  services: Service[];
  initialDate?: string;
  initialTime?: string;
  onClose: () => void;
}) {
  // Only real, non-admin clients can be booked from the dropdown.
  const bookableClients = clients.filter((client) => client.role !== "admin");

  const [mode, setMode] = useState<CustomerMode>("client");
  const [clientId, setClientId] = useState(bookableClients[0]?.id ?? "");
  const [customerName, setCustomerName] = useState("");
  const [serviceId, setServiceId] = useState(services[0]?.id ?? "");
  const [date, setDate] = useState(initialDate ?? "");
  const [time, setTime] = useState(initialTime ?? workingHoursQuarterly[0]);
  const [note, setNote] = useState("");
  const [pending, startTransition] = useTransition();
  const [feedback, setFeedback] = useState<ActionResult | null>(null);

  function submit() {
    setFeedback(null);
    startTransition(async () => {
      const result = await createAdminBookingAction({
        clientId: mode === "client" ? clientId || undefined : undefined,
        customerName: mode === "walkin" ? customerName.trim() || undefined : undefined,
        serviceId,
        date,
        time,
        note: note.trim() || undefined,
      });
      setFeedback(result);
      if (result.ok) onClose();
    });
  }

  const disabled =
    pending ||
    !serviceId ||
    !date ||
    (mode === "client" ? !clientId : customerName.trim().length === 0);

  return (
    <div className="space-y-4">
        <div>
          <span className="mb-2 block text-sm font-medium text-stone-700 dark:text-stone-300">
            Customer
          </span>
          <SegmentedControl
            ariaLabel="Customer type"
            value={mode}
            onChange={setMode}
            options={[
              { label: "Existing client", value: "client" },
              { label: "Walk-in", value: "walkin" },
            ]}
          />
        </div>

        {mode === "client" ? (
          bookableClients.length > 0 ? (
            <Combobox
              label="Client"
              placeholder="Type to search clients…"
              value={clientId}
              onChange={setClientId}
              options={bookableClients.map((client) => ({
                value: client.id,
                label: client.email ? `${client.name} — ${client.email}` : client.name,
              }))}
            />
          ) : (
            <p className="rounded-lg bg-stone-50 px-3 py-2 text-sm text-stone-500 dark:bg-stone-800/60 dark:text-stone-400">
              No registered clients yet. Switch to “Walk-in” to enter a name.
            </p>
          )
        ) : (
          <Field
            label="Walk-in name"
            value={customerName}
            onChange={(event) => setCustomerName(event.target.value)}
            placeholder="e.g. John (phone booking)"
            maxLength={120}
          />
        )}

        <SelectField
          label="Service"
          value={serviceId}
          onChange={(event) => setServiceId(event.target.value)}
        >
          {services.map((service) => (
            <option key={service.id} value={service.id}>
              {service.name} — {service.duration} min · ${service.price}
            </option>
          ))}
        </SelectField>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field
            label="Date"
            type="date"
            value={date}
            onChange={(event) => setDate(event.target.value)}
          />
          <Combobox
            label="Time"
            placeholder="Type a time…"
            value={time}
            onChange={setTime}
            options={workingHoursQuarterly.map((hour) => ({ value: hour, label: hour }))}
          />
        </div>

        <Field
          label="Note (optional)"
          value={note}
          onChange={(event) => setNote(event.target.value)}
          placeholder="Anything to remember about this booking?"
          maxLength={1000}
        />

        <Feedback result={feedback && !feedback.ok ? feedback : null} />

        <div className="flex justify-end gap-2">
          <Button type="button" variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button type="button" onClick={submit} disabled={disabled}>
            {pending ? "Adding…" : "Add booking"}
          </Button>
        </div>
    </div>
  );
}
