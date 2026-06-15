import type {
  InputHTMLAttributes,
  ReactNode,
  SelectHTMLAttributes,
  TextareaHTMLAttributes,
} from "react";

import { cn } from "@/lib/classnames";

const controlClass =
  "w-full rounded-md border border-black/10 bg-white px-3 text-sm text-black outline-none transition placeholder:text-stone-400 focus:border-black focus:ring-2 focus:ring-black/10 dark:border-white/15 dark:bg-stone-900 dark:text-white dark:placeholder:text-stone-500 dark:focus:border-white dark:focus:ring-white/15";

export function Field({
  label,
  className,
  ...props
}: InputHTMLAttributes<HTMLInputElement> & { label: string }) {
  return (
    <label className={cn("block", className)}>
      <span className="text-sm font-medium text-stone-700 dark:text-stone-300">{label}</span>
      <input className={cn("mt-2 h-11", controlClass)} {...props} />
    </label>
  );
}

export function SelectField({
  label,
  className,
  children,
  ...props
}: SelectHTMLAttributes<HTMLSelectElement> & {
  label: string;
  children: ReactNode;
}) {
  return (
    <label className={cn("block", className)}>
      <span className="text-sm font-medium text-stone-700 dark:text-stone-300">{label}</span>
      <select className={cn("mt-2 h-11", controlClass)} {...props}>
        {children}
      </select>
    </label>
  );
}

export function TextAreaField({
  label,
  className,
  ...props
}: TextareaHTMLAttributes<HTMLTextAreaElement> & { label: string }) {
  return (
    <label className={cn("block", className)}>
      <span className="text-sm font-medium text-stone-700 dark:text-stone-300">{label}</span>
      <textarea
        className={cn("mt-2 min-h-28 resize-none py-3", controlClass)}
        {...props}
      />
    </label>
  );
}
