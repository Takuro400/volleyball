"use client";

import type { ReactNode } from "react";

// 共通の小物コンポーネント。フラットデザイン（1px罫線・角丸6〜8px・影なし）を守る。

export function Card({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  // className 側で bg- を指定した場合は既定の白背景を外す（Tailwind は後勝ちしないため）
  const hasBg = /(^|\s)bg-/.test(className);
  return (
    <div
      className={`rounded-lg border border-line ${hasBg ? "" : "bg-white"} ${className}`}
    >
      {children}
    </div>
  );
}

export function SectionTitle({
  children,
  action,
}: {
  children: ReactNode;
  action?: ReactNode;
}) {
  return (
    <div className="mb-3 flex items-end justify-between gap-2">
      <h2 className="flex items-center gap-2 font-display text-base font-bold tracking-wide">
        <span className="inline-block h-3.5 w-1.5 bg-amber" aria-hidden />
        {children}
      </h2>
      {action}
    </div>
  );
}

export function PrimaryButton({
  children,
  onClick,
  type = "button",
  disabled,
  className = "",
}: {
  children: ReactNode;
  onClick?: () => void;
  type?: "button" | "submit";
  disabled?: boolean;
  className?: string;
}) {
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      className={`rounded-md bg-navy px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-navy-hover disabled:cursor-not-allowed disabled:opacity-40 ${className}`}
    >
      {children}
    </button>
  );
}

export function GhostButton({
  children,
  onClick,
  type = "button",
  disabled,
  className = "",
}: {
  children: ReactNode;
  onClick?: () => void;
  type?: "button" | "submit";
  disabled?: boolean;
  className?: string;
}) {
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      className={`rounded-md border border-line bg-white px-3 py-2 text-sm font-medium text-ink transition-colors hover:border-navy disabled:cursor-not-allowed disabled:opacity-40 ${className}`}
    >
      {children}
    </button>
  );
}

export function AdminBadge() {
  return (
    <span className="rounded-md bg-amber px-1.5 py-0.5 font-mono text-[10px] font-medium text-navy">
      運営
    </span>
  );
}

export function ErrorText({ children }: { children: ReactNode }) {
  if (!children) return null;
  return <p className="text-sm text-red-700">{children}</p>;
}

export function EmptyState({ children }: { children: ReactNode }) {
  return (
    <div className="rounded-lg border border-dashed border-line bg-white px-4 py-8 text-center text-sm text-muted">
      {children}
    </div>
  );
}

export function SetupNotice() {
  return (
    <Card className="p-4">
      <p className="text-sm font-medium">Supabase が未設定です</p>
      <p className="mt-1 text-sm text-muted">
        `.env.local` に NEXT_PUBLIC_SUPABASE_URL と
        NEXT_PUBLIC_SUPABASE_ANON_KEY を設定してください（README 参照）。
      </p>
    </Card>
  );
}

export const inputClass =
  "w-full rounded-md border border-line bg-white px-3 py-2.5 text-sm outline-none transition-colors focus:border-navy placeholder:text-muted/70";

export const selectClass =
  "w-full rounded-md border border-line bg-white px-3 py-2.5 text-sm outline-none transition-colors focus:border-navy";
