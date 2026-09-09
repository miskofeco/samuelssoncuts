"use client";

import { Eye, EyeOff } from "lucide-react";
import { useId, useState } from "react";
import type {
  InputHTMLAttributes,
  ReactNode,
  SelectHTMLAttributes,
  TextareaHTMLAttributes,
} from "react";

import { useT } from "@/i18n/provider";
import { cn } from "@/lib/classnames";

export const controlClass =
  "w-full rounded-md border border-black/10 bg-white px-3 text-sm text-black outline-none transition placeholder:text-stone-500 focus:border-black focus:ring-2 focus:ring-black/10 aria-invalid:border-red-500 aria-invalid:focus:ring-red-500/20 disabled:cursor-not-allowed disabled:opacity-60 dark:border-white/15 dark:bg-stone-900 dark:text-white dark:placeholder:text-stone-400 dark:focus:border-white dark:focus:ring-white/15";

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
    <div className={cn("block", className)}>
      <label htmlFor={id} className="text-sm font-medium text-stone-700 dark:text-stone-300">
        {label}
      </label>
      <div className="mt-2">{children}</div>
      {error ? (
        <p id={`${id}-error`} role="alert" className="mt-1.5 text-xs font-medium text-red-700 dark:text-red-300">
          {error}
        </p>
      ) : hint ? (
        <p id={`${id}-hint`} className="mt-1.5 text-xs text-stone-500 dark:text-stone-400">
          {hint}
        </p>
      ) : null}
    </div>
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
      <input
        id={id}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy(id, hint, error)}
        className={cn("h-11", controlClass)}
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
        <input
          id={id}
          type={visible ? "text" : "password"}
          aria-invalid={error ? true : undefined}
          aria-describedby={describedBy(id, hint, error)}
          className={cn("h-11 pr-11", controlClass)}
          {...props}
        />
        <button
          type="button"
          onClick={() => setVisible((v) => !v)}
          aria-label={visible ? t.common.hidePassword : t.common.showPassword}
          aria-pressed={visible}
          className="absolute top-1/2 right-1.5 flex size-8 -translate-y-1/2 items-center justify-center rounded-md text-stone-500 transition hover:bg-stone-100 hover:text-black dark:hover:bg-stone-800 dark:hover:text-white"
        >
          {visible ? <EyeOff className="size-4" aria-hidden /> : <Eye className="size-4" aria-hidden />}
        </button>
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
}: SelectHTMLAttributes<HTMLSelectElement> & FieldChrome & { children: ReactNode }) {
  const autoId = useId();
  const id = idProp ?? autoId;
  return (
    <FieldShell id={id} label={label} hint={hint} error={error} className={className}>
      <select
        id={id}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy(id, hint, error)}
        className={cn("h-11", controlClass)}
        {...props}
      >
        {children}
      </select>
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
      <textarea
        id={id}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy(id, hint, error)}
        className={cn("min-h-28 resize-none py-3", controlClass)}
        {...props}
      />
    </FieldShell>
  );
}
