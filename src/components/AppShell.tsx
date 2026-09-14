"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState, type ReactNode } from "react";
import { AdminProvider, useAdmin } from "./AdminContext";
import { inputClass, PrimaryButton } from "./ui";

const NAV_ITEMS = [
  { href: "/", label: "ホーム" },
  { href: "/entry", label: "エントリー" },
  { href: "/results", label: "結果・順位" },
  { href: "/bracket", label: "トーナメント" },
  { href: "/schedule", label: "試合予定" },
  { href: "/rules", label: "ルール" },
  { href: "/photos", label: "写真" },
] as const;

function AdminLoginModal({ onClose }: { onClose: () => void }) {
  const { login } = useAdmin();
  const [passphrase, setPassphrase] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    const err = await login(passphrase);
    setBusy(false);
    if (err) {
      setError(err);
    } else {
      onClose();
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-navy/50 p-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-sm rounded-lg border border-line bg-white p-5"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="font-display text-base font-bold">運営者モード</h2>
        <p className="mt-1 text-sm text-muted">
          運営用の合言葉を入力してください。
        </p>
        <form onSubmit={submit} className="mt-4 space-y-3">
          <input
            type="password"
            value={passphrase}
            onChange={(e) => setPassphrase(e.target.value)}
            placeholder="合言葉"
            className={inputClass}
            autoFocus
          />
          {error && <p className="text-sm text-red-700">{error}</p>}
          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              className="rounded-md px-3 py-2 text-sm text-muted hover:text-ink"
            >
              キャンセル
            </button>
            <PrimaryButton type="submit" disabled={busy || !passphrase}>
              {busy ? "確認中…" : "ロック解除"}
            </PrimaryButton>
          </div>
        </form>
      </div>
    </div>
  );
}

function Header() {
  const { admin, logout } = useAdmin();
  const [showLogin, setShowLogin] = useState(false);

  return (
    <header className="bg-navy text-white">
      <div className="mx-auto flex max-w-3xl items-center justify-between gap-3 px-4 py-3.5">
        <Link href="/" className="flex items-center gap-2.5">
          <span className="inline-block h-4 w-4 rounded-[3px] bg-amber" aria-hidden />
          <span className="font-display text-base font-bold tracking-wide">
            バレーボール大会
          </span>
        </Link>
        <div className="flex items-center gap-2">
          <span className="font-mono text-xs text-white/70">2026.11.27</span>
          {admin ? (
            <button
              onClick={logout}
              className="rounded-md bg-amber px-2.5 py-1.5 font-mono text-xs font-medium text-navy transition-colors hover:opacity-90"
              title="運営モードを終了"
            >
              運営中
            </button>
          ) : (
            <button
              onClick={() => setShowLogin(true)}
              aria-label="運営者モード"
              title="運営者モード"
              className="rounded-md border border-white/25 px-2.5 py-1.5 font-mono text-xs text-white/70 transition-colors hover:border-white/60 hover:text-white"
            >
              ⚿ 運営
            </button>
          )}
        </div>
      </div>
      {showLogin && <AdminLoginModal onClose={() => setShowLogin(false)} />}
    </header>
  );
}

function Nav() {
  const pathname = usePathname();
  return (
    <nav className="sticky top-0 z-40 border-b border-line bg-white">
      <div className="mx-auto max-w-3xl overflow-x-auto">
        <div className="flex min-w-max px-2">
          {NAV_ITEMS.map((item) => {
            const active = pathname === item.href;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`relative whitespace-nowrap px-3 py-3 text-sm transition-colors ${
                  active
                    ? "font-semibold text-navy"
                    : "font-medium text-muted hover:text-ink"
                }`}
              >
                {item.label}
                {active && (
                  <span className="absolute inset-x-3 bottom-0 h-0.5 bg-amber" />
                )}
              </Link>
            );
          })}
        </div>
      </div>
    </nav>
  );
}

export default function AppShell({ children }: { children: ReactNode }) {
  return (
    <AdminProvider>
      <Header />
      <Nav />
      <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-6 pb-16">
        {children}
      </main>
      <footer className="border-t border-line bg-white">
        <div className="mx-auto max-w-3xl px-4 py-4 text-center font-mono text-xs text-muted">
          KYUTECH VOLLEYBALL 2026 — 折尾スポーツセンター
        </div>
      </footer>
    </AdminProvider>
  );
}
