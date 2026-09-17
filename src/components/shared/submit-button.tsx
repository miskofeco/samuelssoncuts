"use client";

import { useFormStatus } from "react-dom";
import type { ReactNode } from "react";

import { Button, type ButtonSize, type ButtonVariant } from "@/components/shared/button";

// A submit button for plain server-action <form action={...}> flows. It reads
// the parent form's pending state via useFormStatus and disables itself while
// the action is in flight, preventing double-submits (duplicate sign-in /
// registration requests). Optionally swaps its label for a "sending" state.
export function SubmitButton({
  children,
  pendingLabel,
  className,
  variant,
  size = "lg",
}: {
  children: ReactNode;
  pendingLabel?: ReactNode;
  className?: string;
  variant?: ButtonVariant;
  size?: ButtonSize;
}) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" variant={variant} size={size} className={className} loading={pending}>
      {pending && pendingLabel ? pendingLabel : children}
    </Button>
  );
}
