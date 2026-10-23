"use client";

import { useState } from "react";
import { postJson } from "@/lib/hooks";
import type { TieGroup } from "@/lib/standings";
import { AdminBadge, PrimaryButton } from "../ui";

// 勝ち数・得失点差・総得点まで同率のチームの順位を、運営が手動で決める。
// 一般の閲覧者には「運営が決定します」と表示するだけ。
export default function TieBreaker({
  title,
  group,
  admin,
  onSaved,
}: {
  title: string;
  group: TieGroup;
  admin: boolean;
  onSaved: () => void;
}) {
  const [order, setOrder] = useState(() => group.standings.map((s) => s.team.id));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const byId = new Map(group.standings.map((s) => [s.team.id, s]));

  const move = (i: number, dir: -1 | 1) => {
    const j = i + dir;
    if (j < 0 || j >= order.length) return;
    const next = [...order];
    [next[i], next[j]] = [next[j], next[i]];
    setOrder(next);
  };

  const save = async () => {
    setBusy(true);
    setError(null);
    try {
      await postJson("/api/admin/rank", "POST", { order });
      onSaved();
    } catch (e) {
      setError(e instanceof Error ? e.message : "保存に失敗しました");
    } finally {
      setBusy(false);
    }
  };

  const sample = group.standings[0];
  return (
    <div className="rounded-md border border-amber bg-amber/10 p-3">
      <p className="flex items-center gap-2 text-sm font-semibold">
        {admin && <AdminBadge />}
        同率: {title}
      </p>
      <p className="mt-1 text-xs text-muted">
        {sample.wins}勝 / 得失点差 {sample.diff > 0 ? `+${sample.diff}` : sample.diff} /
        総得点 {sample.pointsFor} で並んでいます。
        {admin ? "上から順位の高い順に並べ替えて確定してください。" : "運営が順位を決定します。"}
      </p>
      <ol className="mt-2 space-y-1.5">
        {order.map((id, i) => (
          <li
            key={id}
            className="flex items-center gap-2 rounded-md border border-line bg-white px-2.5 py-1.5"
          >
            <span className="w-4 font-mono text-xs text-amber-deep">{i + 1}</span>
            <span className="min-w-0 flex-1 truncate text-sm font-medium">
              {byId.get(id)?.team.name}
              {byId.get(id)?.team.block && (
                <span className="ml-1.5 font-mono text-[10px] text-muted">
                  {byId.get(id)?.team.block}
                </span>
              )}
            </span>
            {admin && (
              <>
                <button
                  type="button"
                  onClick={() => move(i, -1)}
                  disabled={i === 0}
                  aria-label="順位を上げる"
                  className="rounded-md border border-line px-2 py-0.5 text-xs disabled:opacity-30"
                >
                  ▲
                </button>
                <button
                  type="button"
                  onClick={() => move(i, 1)}
                  disabled={i === order.length - 1}
                  aria-label="順位を下げる"
                  className="rounded-md border border-line px-2 py-0.5 text-xs disabled:opacity-30"
                >
                  ▼
                </button>
              </>
            )}
          </li>
        ))}
      </ol>
      {admin && (
        <>
          {error && <p className="mt-2 text-sm text-red-700">{error}</p>}
          <PrimaryButton onClick={save} disabled={busy} className="mt-2 w-full">
            {busy ? "保存中…" : "この順位で確定"}
          </PrimaryButton>
        </>
      )}
    </div>
  );
}
