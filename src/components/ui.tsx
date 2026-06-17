"use client";

import Link from "next/link";
import { ChevronRight } from "lucide-react";
import React from "react";
import { isoToGermanDate, parseGermanDate } from "@/lib/time";

const tapMinStyle = { minHeight: "var(--tap-min)" } as const;
const tapMinSquareStyle = {
  minHeight: "var(--tap-min)",
  minWidth: "var(--tap-min)",
} as const;

export function Card({
  children,
  className = "",
  padded = true,
}: {
  children: React.ReactNode;
  className?: string;
  padded?: boolean;
}) {
  return (
    <div
      className={[
        "bg-[var(--card)] rounded-[var(--radius)]",
        padded ? "p-4" : "",
        className,
      ].join(" ")}
    >
      {children}
    </div>
  );
}

export function ListCard({
  children,
  className = "",
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={[
        "bg-[var(--card)] rounded-[var(--radius)] overflow-hidden divide-y divide-[var(--divider)]",
        className,
      ].join(" ")}
    >
      {children}
    </div>
  );
}

export function ListRow({
  href,
  onClick,
  title,
  subtitle,
  trailing,
  className = "",
}: {
  href?: string;
  onClick?: () => void;
  title: React.ReactNode;
  subtitle?: React.ReactNode;
  trailing?: React.ReactNode;
  className?: string;
}) {
  const inner = (
    <>
      <div className="min-w-0 flex-1 py-4">
        <div className="font-semibold text-[var(--foreground)] truncate">{title}</div>
        {subtitle ? (
          <div className="mt-0.5 text-sm text-[var(--muted)]">{subtitle}</div>
        ) : null}
      </div>
      {trailing ? (
        <div className="shrink-0 pl-3 font-bold text-[var(--accent)] tabular-nums">{trailing}</div>
      ) : null}
      <ChevronRight
        className="h-5 w-5 shrink-0 text-[var(--muted)] ml-2"
        aria-hidden="true"
      />
    </>
  );

  const rowClass = [
    "flex items-center px-4 w-full text-left",
    "hover:bg-[var(--background)] active:bg-[var(--background)]",
    className,
  ].join(" ");

  if (href) {
    return (
      <Link href={href} className={rowClass} style={tapMinStyle}>
        {inner}
      </Link>
    );
  }

  return (
    <button type="button" onClick={onClick} className={rowClass} style={tapMinStyle}>
      {inner}
    </button>
  );
}

type ButtonVariant = "primary" | "outline" | "ghost" | "danger";

export function Button({
  children,
  onClick,
  type = "button",
  variant = "primary",
  disabled,
  className = "",
}: {
  children: React.ReactNode;
  onClick?: () => void;
  type?: "button" | "submit";
  variant?: ButtonVariant;
  disabled?: boolean;
  className?: string;
}) {
  const base =
    "px-5 py-3 w-full flex items-center justify-center gap-2 rounded-[var(--radius)] font-semibold";
  const styles =
    variant === "primary"
      ? "bg-[var(--accent)] text-white border-0"
      : variant === "outline"
        ? "bg-[var(--card)] text-[var(--foreground)] border border-[var(--divider)]"
        : variant === "danger"
          ? "bg-[var(--card)] text-red-700 border border-red-300"
          : "bg-transparent text-[var(--foreground)] border-0";
  const dis = disabled ? "opacity-50 pointer-events-none" : "";

  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      className={[base, styles, dis, className].join(" ")}
      style={tapMinStyle}
    >
      {children}
    </button>
  );
}

export function Input({
  label,
  value,
  onChange,
  type = "text",
  placeholder,
  required,
  name,
  onBlur,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  type?: string;
  placeholder?: string;
  required?: boolean;
  name?: string;
  onBlur?: () => void;
}) {
  return (
    <label className="block">
      <div className="text-sm font-semibold mb-1.5 text-[var(--foreground)]">{label}</div>
      <input
        name={name}
        required={required}
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onBlur={onBlur}
        placeholder={placeholder}
        className="w-full px-4 rounded-[var(--radius)] border border-[var(--divider)] bg-[var(--card)] text-[var(--foreground)]"
        style={tapMinStyle}
      />
    </label>
  );
}

export function DateInput({
  label,
  value,
  onChange,
  required,
  name,
}: {
  label: string;
  value: string;
  onChange: (iso: string) => void;
  required?: boolean;
  name?: string;
}) {
  const [display, setDisplay] = React.useState(() => (value ? isoToGermanDate(value) : ""));

  React.useEffect(() => {
    setDisplay(value ? isoToGermanDate(value) : "");
  }, [value]);

  return (
    <Input
      label={label}
      name={name}
      required={required}
      value={display}
      placeholder="17.06.2026"
      onChange={(v) => {
        setDisplay(v);
        const iso = parseGermanDate(v);
        if (iso) onChange(iso);
      }}
      onBlur={() => {
        const iso = parseGermanDate(display);
        if (iso) {
          onChange(iso);
          setDisplay(isoToGermanDate(iso));
        }
      }}
    />
  );
}

export function Textarea({
  label,
  value,
  onChange,
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
}) {
  return (
    <label className="block">
      <div className="text-sm font-semibold mb-1.5 text-[var(--foreground)]">{label}</div>
      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="min-h-24 w-full px-4 py-3 rounded-[var(--radius)] border border-[var(--divider)] bg-[var(--card)] text-[var(--foreground)]"
      />
    </label>
  );
}

export function SectionTitle({ children }: { children: React.ReactNode }) {
  return <h2 className="text-lg font-semibold text-[var(--foreground)]">{children}</h2>;
}

export function OptionButton({
  active,
  children,
  onClick,
}: {
  active: boolean;
  children: React.ReactNode;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={[
        "px-4 py-3 w-full text-left rounded-[var(--radius)] font-semibold",
        active
          ? "bg-[var(--accent)] text-white"
          : "bg-[var(--background)] text-[var(--foreground)] border border-[var(--divider)]",
      ].join(" ")}
      style={tapMinStyle}
    >
      {children}
    </button>
  );
}

export function IconButton({
  children,
  onClick,
  "aria-label": ariaLabel,
}: {
  children: React.ReactNode;
  onClick?: () => void;
  "aria-label": string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={ariaLabel}
      className="flex items-center justify-center rounded-[var(--radius)] bg-[var(--card)] border border-[var(--divider)] text-[var(--foreground)]"
      style={tapMinSquareStyle}
    >
      {children}
    </button>
  );
}
