"use client";

import { useState } from "react";
import { postJson } from "@/lib/hooks";
import type { Match } from "@/lib/types";
import { GhostButton } from "./ui";

// 運営用のスコア入力フォーム（結果・順位ページとトーナメントページで共用）
export default function ScoreEditor({
  match,
  onSaved,
}: {
  match: Match;
  onSaved: () => void;
}) {
  const [scoreA, setScoreA] = useState(match.score_a?.toString() ?? "");
  const [scoreB, setScoreB] = useState(match.score_b?.toString() ?? "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const save = async () => {
    setBusy(true);
    setError(null);
    try {
      await postJson("/api/admin/matches", "PATCH", {
        id: match.id,
        scoreA: scoreA === "" ? null : Number(scoreA),
        scoreB: scoreB === "" ? null : Number(scoreB),
      });
      onSaved();
    } catch (e) {
      setError(e instanceof Error ? e.message : "保存に失敗しました");
    } finally {
      setBusy(false);
    }
  };

  const scoreInput =
    "w-14 rounded-md border border-line bg-white px-2 py-1.5 text-center font-mono text-sm outline-none focus:border-navy";

  return (
    <div>
      <div className="flex items-center justify-center gap-2">
        <input
          type="number"
          min={0}
          max={99}
          value={scoreA}
          onChange={(e) => setScoreA(e.target.value)}
          className={scoreInput}
          aria-label="チームAのスコア"
        />
        <span className="font-mono text-xs text-muted">–</span>
        <input
          type="number"
          min={0}
          max={99}
          value={scoreB}
          onChange={(e) => setScoreB(e.target.value)}
          className={scoreInput}
          aria-label="チームBのスコア"
        />
        <GhostButton onClick={save} disabled={busy} className="px-3 py-1.5 text-xs">
          {busy ? "…" : "保存"}
        </GhostButton>
      </div>
      {error && <p className="mt-1 text-center text-xs text-red-700">{error}</p>}
    </div>
  );
}
