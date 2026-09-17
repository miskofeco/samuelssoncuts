import Link from "next/link";
import type { AnchorHTMLAttributes, ComponentProps, ReactNode } from "react";

import { Button as UiButton, buttonVariants as uiButtonVariants } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { cn } from "@/lib/classnames";

type UiVariant = NonNullable<ComponentProps<typeof UiButton>["variant"]>;
type UiSize = NonNullable<ComponentProps<typeof UiButton>["size"]>;

/**
 * shadcn variants plus the app's legacy aliases so existing call sites keep
 * working: primary → default, secondary → outline, soft → secondary,
 * danger → destructive, dangerOutline → destructive-outline.
 */
export type ButtonVariant = UiVariant | "primary" | "secondary" | "soft" | "danger" | "dangerOutline";
export type ButtonSize = UiSize | "md" | "iconSm";

const variantAlias: Partial<Record<ButtonVariant, UiVariant>> = {
  primary: "default",
  secondary: "outline",
  soft: "secondary",
  danger: "destructive",
  dangerOutline: "destructive-outline",
};

const sizeAlias: Partial<Record<ButtonSize, UiSize>> = {
  md: "default",
  iconSm: "icon-sm",
};

export function resolveButtonVariant(variant?: ButtonVariant | null): UiVariant {
  if (!variant) return "default";
  return variantAlias[variant] ?? (variant as UiVariant);
}

export function resolveButtonSize(size?: ButtonSize | null): UiSize {
  if (!size) return "default";
  return sizeAlias[size] ?? (size as UiSize);
}

export function buttonVariants({
  variant,
  size,
  className,
}: {
  variant?: ButtonVariant | null;
  size?: ButtonSize | null;
  className?: string;
} = {}) {
  return uiButtonVariants({
    variant: resolveButtonVariant(variant),
    size: resolveButtonSize(size),
    className,
  });
}

/** Class string for a button-styled element (for `<form>`/`<Link>` callers). */
export function buttonClass(variant: ButtonVariant = "primary", className?: string, size: ButtonSize = "md") {
  return cn(buttonVariants({ variant, size }), className);
}

type ButtonProps = Omit<ComponentProps<typeof UiButton>, "variant" | "size"> & {
  variant?: ButtonVariant | null;
  size?: ButtonSize | null;
  children: ReactNode;
  /** Shows a spinner, sets aria-busy and disables the button. */
  loading?: boolean;
};

export function Button({
  className,
  variant,
  size,
  loading = false,
  disabled,
  children,
  type = "button",
  ...props
}: ButtonProps) {
  return (
    <UiButton
      type={type}
      variant={resolveButtonVariant(variant)}
      size={resolveButtonSize(size)}
      className={className}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      {...props}
    >
      {loading ? <Spinner aria-hidden /> : null}
      {children}
    </UiButton>
  );
}

type ButtonLinkProps = AnchorHTMLAttributes<HTMLAnchorElement> & {
  href: string;
  variant?: ButtonVariant | null;
  size?: ButtonSize | null;
  children: ReactNode;
  /** Pass `false` to opt out of client-side prefetch (e.g. auth routes). */
  prefetch?: boolean;
};

/** A link styled as a button (for navigation, not actions). */
export function ButtonLink({ href, className, variant, size, children, prefetch, ...props }: ButtonLinkProps) {
  return (
    <Link href={href} prefetch={prefetch} className={cn(buttonVariants({ variant, size }), className)} {...props}>
      {children}
    </Link>
  );
}
