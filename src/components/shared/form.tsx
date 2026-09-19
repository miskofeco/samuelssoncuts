"use client";

import { ViewIcon, ViewOffSlashIcon } from "@hugeicons/core-free-icons";
import { useId, useState } from "react";
import type {
  InputHTMLAttributes,
  ReactNode,
  SelectHTMLAttributes,
  TextareaHTMLAttributes,
} from "react";

import { Icon } from "@/components/shared/icon";
import { Button } from "@/components/ui/button";
import { Field as UiField, FieldDescription, FieldError, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import { Textarea } from "@/components/ui/textarea";
import { useT } from "@/i18n/provider";
import { cn } from "@/lib/classnames";

type FieldChrome = {
  label: string;
  /** Helper text under the control. */
  hint?: ReactNode;
  /** Validation error; sets `aria-invalid` and replaces the hint. */
  error?: string | null;
  className?: string;
};

function FieldShell({
  id,
  label,
  hint,
  error,
  className,
  children,
}: FieldChrome & { id: string; children: ReactNode }) {
  return (
    <UiField data-invalid={error ? true : undefined} className={cn("gap-1.5", className)}>
      <FieldLabel htmlFor={id} className="text-sm font-medium text-foreground">
        {label}
      </FieldLabel>
      {children}
      {error ? (
        <FieldError id={`${id}-error`} className="text-xs font-medium">
          {error}
        </FieldError>
      ) : hint ? (
        <FieldDescription id={`${id}-hint`} className="text-xs">
          {hint}
        </FieldDescription>
      ) : null}
    </UiField>
  );
}

function describedBy(id: string, hint?: ReactNode, error?: string | null) {
  if (error) return `${id}-error`;
  if (hint) return `${id}-hint`;
  return undefined;
}

export function Field({
  label,
  hint,
  error,
  className,
  id: idProp,
  ...props
}: InputHTMLAttributes<HTMLInputElement> & FieldChrome) {
  const autoId = useId();
  const id = idProp ?? autoId;
  return (
    <FieldShell id={id} label={label} hint={hint} error={error} className={className}>
      <Input
        id={id}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy(id, hint, error)}
        {...props}
      />
    </FieldShell>
  );
}

/** Password input with a show/hide toggle. Pass `autoComplete` explicitly. */
export function PasswordField({
  label,
  hint,
  error,
  className,
  id: idProp,
  ...props
}: Omit<InputHTMLAttributes<HTMLInputElement>, "type"> & FieldChrome) {
  const t = useT();
  const autoId = useId();
  const id = idProp ?? autoId;
  const [visible, setVisible] = useState(false);
  return (
    <FieldShell id={id} label={label} hint={hint} error={error} className={className}>
      <div className="relative">
        <Input
          id={id}
          type={visible ? "text" : "password"}
          aria-invalid={error ? true : undefined}
          aria-describedby={describedBy(id, hint, error)}
          className="pr-11"
          {...props}
        />
        {/* The wrapper owns the vertical centring: the button's own press
            transform (active:translate-y-px) would otherwise replace it and
            make the toggle jump on click. */}
        <span className="absolute inset-y-0 right-1 flex items-center">
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            onClick={() => setVisible((v) => !v)}
            aria-label={visible ? t.common.hidePassword : t.common.showPassword}
            aria-pressed={visible}
            className="text-muted-foreground"
          >
            <Icon icon={visible ? ViewOffSlashIcon : ViewIcon} />
          </Button>
        </span>
      </div>
    </FieldShell>
  );
}

export function SelectField({
  label,
  hint,
  error,
  className,
  id: idProp,
  children,
  ...props
}: Omit<SelectHTMLAttributes<HTMLSelectElement>, "size"> & FieldChrome & { children: ReactNode }) {
  const autoId = useId();
  const id = idProp ?? autoId;
  return (
    <FieldShell id={id} label={label} hint={hint} error={error} className={className}>
      <NativeSelect
        id={id}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy(id, hint, error)}
        {...props}
      >
        {children}
      </NativeSelect>
    </FieldShell>
  );
}

export function TextAreaField({
  label,
  hint,
  error,
  className,
  id: idProp,
  ...props
}: TextareaHTMLAttributes<HTMLTextAreaElement> & FieldChrome) {
  const autoId = useId();
  const id = idProp ?? autoId;
  return (
    <FieldShell id={id} label={label} hint={hint} error={error} className={className}>
      <Textarea
        id={id}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy(id, hint, error)}
        className="min-h-28 resize-none"
        {...props}
      />
    </FieldShell>
  );
}
