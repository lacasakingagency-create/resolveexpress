import React, { useState, useEffect } from "react";
import * as Icons from "lucide-react";

export const Icon = ({
  name,
  className = "",
  strokeWidth = 2,
  ...props
}: {
  name: string;
  className?: string;
  strokeWidth?: number;
  [key: string]: any;
}) => {
  const IconComponent = (Icons as unknown as Record<string, React.ComponentType<any>>)[name] || Icons.Circle;
  return <IconComponent className={className} strokeWidth={strokeWidth} {...props} />;
};

export function useRoute(): string {
  const get = () => window.location.hash.replace(/^#/, "") || "/";
  const [route, setRoute] = useState(get);
  useEffect(() => {
    const f = () => {
      setRoute(get());
      window.scrollTo(0, 0);
    };
    window.addEventListener("hashchange", f);
    return () => window.removeEventListener("hashchange", f);
  }, []);
  return route;
}

export const go = (path: string) => {
  window.location.hash = path;
};

export const Btn = ({
  kind = "action",
  className = "",
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & {
  kind?: "action" | "ink" | "ghost";
}) => (
  <button
    type="button"
    {...props}
    className={
      (kind === "action"
        ? "bg-action text-action-ink hover:brightness-105 "
        : kind === "ink"
          ? "bg-primary text-primary-foreground hover:brightness-110 "
          : "border border-border bg-paper text-foreground hover:bg-mist ") +
      "inline-flex min-h-12 items-center justify-center gap-2 rounded-[var(--radius)] px-6 font-display text-sm font-bold uppercase tracking-wide transition active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50 " +
      className
    }
  />
);

export const Field = ({
  label,
  error,
  hint,
  children,
}: {
  label: React.ReactNode;
  error?: React.ReactNode;
  hint?: React.ReactNode;
  children: React.ReactNode;
}) => (
  <label className="flex flex-col gap-2">
    <span className="text-sm font-semibold">{label}</span>
    {children}
    {error ? (
      <span className="text-sm text-destructive">{error}</span>
    ) : hint ? (
      <span className="text-sm text-muted-foreground">{hint}</span>
    ) : null}
  </label>
);

export const inputCls =
  "min-h-12 w-full rounded-[var(--radius)] border border-border bg-paper px-4 text-base outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/20";
export const selectCls = inputCls;

export const Section = ({
  eyebrow,
  title,
  children,
  className = "",
  action,
  dark,
  id,
}: {
  eyebrow?: React.ReactNode;
  title: React.ReactNode;
  children: React.ReactNode;
  className?: string;
  action?: React.ReactNode;
  dark?: boolean;
  id?: string;
}) => (
  <section
    id={id}
    className={
      "mx-auto w-full max-w-6xl px-4 py-16 @3xl:px-8 @3xl:py-24 " + className
    }
  >
    <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
      <div>
        {eyebrow && (
          <p
            className={
              "mb-2 font-display text-sm font-bold uppercase tracking-widest " +
              (dark ? "text-action" : "text-action-text")
            }
          >
            {eyebrow}
          </p>
        )}
        <h2 className="max-w-2xl font-display text-3xl font-bold leading-tight tracking-tight @3xl:text-4xl">
          {title}
        </h2>
      </div>
      {action}
    </div>
    {children}
  </section>
);

export const Empty = ({
  icon = "Inbox",
  title,
  text,
  children,
}: {
  icon?: string;
  title: React.ReactNode;
  text?: React.ReactNode;
  children?: React.ReactNode;
}) => (
  <div className="flex flex-col items-center gap-3 rounded-[var(--radius)] border border-dashed border-border bg-paper px-6 py-16 text-center">
    <Icon name={icon} className="size-8 text-muted-foreground" />
    <p className="font-display text-lg font-bold">{title}</p>
    {text && <p className="max-w-sm text-muted-foreground">{text}</p>}
    {children}
  </div>
);

export const FilePick = ({
  label = "Escolher ficheiro",
  multiple,
  accept,
  files,
  onFiles,
}: {
  label?: string;
  multiple?: boolean;
  accept?: string;
  files?: string[];
  onFiles: (files: string[]) => void;
}) => (
  <span className="flex flex-wrap items-center gap-3">
    <span className="relative inline-flex min-h-11 cursor-pointer items-center gap-2 rounded-[var(--radius)] bg-mist px-4 text-sm font-semibold hover:brightness-95">
      <Icon name="Paperclip" className="size-4" />
      {label}
      <input
        type="file"
        multiple={multiple}
        accept={accept}
        onChange={(e) => {
          if (e.target.files) {
            onFiles(Array.from(e.target.files).map((f) => f.name));
          }
        }}
        className="absolute inset-0 cursor-pointer opacity-0"
      />
    </span>
    <span className="text-sm text-muted-foreground">
      {files?.length ? files.join(", ") : "Nenhum ficheiro"}
    </span>
  </span>
);
