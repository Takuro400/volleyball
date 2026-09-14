"use client";

import { useState } from "react";
import { useAdmin } from "@/components/AdminContext";
import ScoreEditor from "@/components/ScoreEditor";
import {
  AdminBadge,
  Card,
  EmptyState,
  PrimaryButton,
  SectionTitle,
  SetupNotice,
} from "@/components/ui";
import { postJson, useMatches, useTeams } from "@/lib/hooks";
import { bracketReady, computeStandings, isFinished } from "@/lib/standings";
import { BLOCKS, type Block, type Match, type Team } from "@/lib/types";

type Slot = {
  seedLabel: string; // "1位" など。未確定スロットは ""
  team: Team | null;
  score: number | null;
  isWinner: boolean;
};

// トーナメント表の1試合ぶんのボックス（上下2段）
function MatchBox({ top, bottom }: { top: Slot; bottom: Slot }) {
  const row = (slot: Slot, extraClass: string) => (
    <div
      className={`flex h-9 items-center gap-1.5 px-2.5 ${extraClass} ${
        slot.isWinner ? "bg-amber/15" : "bg-white"
      }`}
    >
      {slot.seedLabel && (
        <span className="shrink-0 font-mono text-[10px] text-amber-deep">
          {slot.seedLabel}
        </span>
      )}
      <span
        className={`min-w-0 flex-1 truncate text-[13px] ${
          slot.isWinner ? "font-semibold text-navy" : slot.team ? "font-medium" : "text-muted"
        }`}
      >
        {slot.team ? slot.team.name : "勝者未定"}
      </span>
      {slot.score !== null && (
        <span
          className={`shrink-0 font-mono text-[13px] tabular-nums ${
            slot.isWinner ? "font-medium text-navy" : "text-muted"
          }`}
        >
          {slot.score}
        </span>
      )}
    </div>
  );

  return (
    <div className="w-full overflow-hidden rounded-md border border-line">
      {row(top, "border-b border-line")}
      {row(bottom, "")}
    </div>
  );
}

function slotsFor(
  teamTop: Team | null,
  teamBottom: Team | null,
  labelTop: string,
  labelBottom: string,
  dbMatch: Match | undefined
): { top: Slot; bottom: Slot } {
  let scoreTop: number | null = null;
  let scoreBottom: number | null = null;
  if (dbMatch && isFinished(dbMatch)) {
    // DB上の team_a/team_b の並びと表示上の上下は一致しない場合があるので対応付ける
    const topIsA = teamTop !== null && dbMatch.team_a === teamTop.id;
    scoreTop = topIsA ? dbMatch.score_a : dbMatch.score_b;
    scoreBottom = topIsA ? dbMatch.score_b : dbMatch.score_a;
  }
  const finished = scoreTop !== null && scoreBottom !== null;
  return {
    top: {
      seedLabel: labelTop,
      team: teamTop,
      score: scoreTop,
      isWinner: finished && (scoreTop as number) > (scoreBottom as number),
    },
    bottom: {
      seedLabel: labelBottom,
      team: teamBottom,
      score: scoreBottom,
      isWinner: finished && (scoreBottom as number) > (scoreTop as number),
    },
  };
}

function matchWinner(m: Match | undefined, teams: Team[]): Team | null {
  if (!m || !isFinished(m) || m.score_a === m.score_b) return null;
  const winnerId = (m.score_a as number) > (m.score_b as number) ? m.team_a : m.team_b;
  return teams.find((t) => t.id === winnerId) ?? null;
}

function BlockBracket({
  block,
  teams,
  matches,
  admin,
  onChanged,
}: {
  block: Block;
  teams: Team[];
  matches: Match[];
  admin: boolean;
  onChanged: () => void;
}) {
  const [busy, setBusy] = useState(false);
  const standings = computeStandings(teams, matches, block);
  const ready = bracketReady(standings);
  const bracketMatches = matches.filter(
    (m) => m.round === "bracket" && m.block === block
  );

  const findDbMatch = (a: Team | null, b: Team | null) =>
    a && b
      ? bracketMatches.find(
          (m) =>
            (m.team_a === a.id && m.team_b === b.id) ||
            (m.team_a === b.id && m.team_b === a.id)
        )
      : undefined;

  const seed = (i: number): Team | null => standings[i]?.team ?? null;

  // 準決勝: 1位vs4位 / 2位vs3位
  const sf1Db = ready ? findDbMatch(seed(0), seed(3)) : undefined;
  const sf2Db = ready ? findDbMatch(seed(1), seed(2)) : undefined;
  const sf1Winner = matchWinner(sf1Db, teams);
  const sf2Winner = matchWinner(sf2Db, teams);
  const finalDb = findDbMatch(sf1Winner, sf2Winner);
  const champion = matchWinner(finalDb, teams);

  const sf1 = slotsFor(seed(0), seed(3), "1位", "4位", sf1Db);
  const sf2 = slotsFor(seed(1), seed(2), "2位", "3位", sf2Db);
  const fin = slotsFor(sf1Winner, sf2Winner, "", "", finalDb);

  const registerSemis = async () => {
    if (
      !window.confirm(
        `ブロック ${block} の準決勝（1位vs4位・2位vs3位）を試合として登録しますか？`
      )
    )
      return;
    setBusy(true);
    try {
      await postJson("/api/admin/matches", "POST", {
        round: "bracket",
        block,
        teamA: seed(0)!.id,
        teamB: seed(3)!.id,
      });
      await postJson("/api/admin/matches", "POST", {
        round: "bracket",
        block,
        teamA: seed(1)!.id,
        teamB: seed(2)!.id,
      });
      onChanged();
    } finally {
      setBusy(false);
    }
  };

  const registerFinal = async () => {
    if (!sf1Winner || !sf2Winner) return;
    if (
      !window.confirm(
        `ブロック ${block} の決勝（${sf1Winner.name} vs ${sf2Winner.name}）を登録しますか？`
      )
    )
      return;
    setBusy(true);
    try {
      await postJson("/api/admin/matches", "POST", {
        round: "bracket",
        block,
        teamA: sf1Winner.id,
        teamB: sf2Winner.id,
      });
      onChanged();
    } finally {
      setBusy(false);
    }
  };

  // 運営用: 登録済みのトーナメント試合にスコアを入れる行
  const adminMatchRow = (label: string, m: Match | undefined) => {
    if (!m) return null;
    const nameOf = (id: string | null) =>
      teams.find((t) => t.id === id)?.name ?? "不明";
    return (
      <div key={m.id} className="rounded-md border border-line bg-white p-2.5">
        <p className="mb-1.5 text-center text-xs text-muted">
          <span className="mr-1.5 font-mono text-amber-deep">{label}</span>
          {nameOf(m.team_a)}（左） vs {nameOf(m.team_b)}（右）
        </p>
        <ScoreEditor match={m} onSaved={onChanged} />
        <div className="mt-1 text-right">
          <button
            onClick={async () => {
              if (!window.confirm(`${label}の試合を削除しますか？`)) return;
              await postJson("/api/admin/matches", "DELETE", { id: m.id });
              onChanged();
            }}
            className="text-xs text-muted underline-offset-2 hover:text-red-600 hover:underline"
          >
            削除
          </button>
        </div>
      </div>
    );
  };

  return (
    <Card>
      <div className="flex items-center justify-between border-b border-line px-4 py-2.5">
        <span className="font-mono text-xs font-medium text-amber-deep">
          ブロック {block}
        </span>
        <span className="font-mono text-xs text-muted">
          {standings.length} teams
        </span>
      </div>

      {ready ? (
        <div className="p-3">
          {/* トーナメント表: 準決勝 → 連結線 → 決勝 */}
          <div className="flex items-stretch">
            {/* 準決勝の列 */}
            <div className="flex min-w-0 flex-1 flex-col">
              <div className="flex flex-1 items-center py-2">
                <MatchBox top={sf1.top} bottom={sf1.bottom} />
              </div>
              <div className="flex flex-1 items-center py-2">
                <MatchBox top={sf2.top} bottom={sf2.bottom} />
              </div>
            </div>

            {/* 連結線: 各準決勝の中心から縦線で合流 */}
            <div className="flex w-4 shrink-0 flex-col" aria-hidden>
              <div className="flex flex-1 flex-col">
                <div className="flex-1" />
                <div className="flex-1 border-t-2 border-r-2 border-line" />
              </div>
              <div className="flex flex-1 flex-col">
                <div className="flex-1 border-b-2 border-r-2 border-line" />
                <div className="flex-1" />
              </div>
            </div>
            {/* 合流点から決勝への横線 */}
            <div className="flex w-4 shrink-0 flex-col" aria-hidden>
              <div className="flex-1 border-b-2 border-line" />
              <div className="flex-1" />
            </div>

            {/* 決勝の列 */}
            <div className="flex min-w-0 flex-1 flex-col justify-center">
              <p className="mb-1 text-center font-mono text-[10px] tracking-widest text-muted">
                FINAL
              </p>
              <MatchBox top={fin.top} bottom={fin.bottom} />
            </div>
          </div>

          {/* ラウンドラベル */}
          <div className="mt-1 flex">
            <p className="flex-1 text-center font-mono text-[10px] tracking-widest text-muted">
              SEMI FINAL
            </p>
            <div className="w-8 shrink-0" />
            <div className="flex-1" />
          </div>

          {champion && (
            <div className="mt-3 flex items-center justify-center gap-2 rounded-md bg-navy px-3 py-2.5">
              <span className="font-mono text-[10px] tracking-widest text-amber">
                CHAMPION
              </span>
              <span className="text-sm font-semibold text-white">
                {champion.name}
              </span>
            </div>
          )}

          {admin && (
            <div className="mt-3 space-y-2 rounded-md border border-amber bg-amber/10 p-3">
              <p className="flex items-center gap-2 text-xs font-semibold">
                <AdminBadge /> トーナメント運営
              </p>
              {bracketMatches.length === 0 && (
                <PrimaryButton onClick={registerSemis} disabled={busy} className="w-full">
                  {busy ? "登録中…" : "準決勝を試合として登録"}
                </PrimaryButton>
              )}
              {adminMatchRow("準決勝1", sf1Db)}
              {adminMatchRow("準決勝2", sf2Db)}
              {sf1Winner && sf2Winner && !finalDb && (
                <PrimaryButton onClick={registerFinal} disabled={busy} className="w-full">
                  {busy ? "登録中…" : "決勝を登録"}
                </PrimaryButton>
              )}
              {adminMatchRow("決勝", finalDb)}
            </div>
          )}
        </div>
      ) : (
        <p className="px-4 py-5 text-center text-sm text-muted">
          リーグ戦（各チーム2試合）が終了すると
          <br />
          トーナメント表が自動で表示されます
          {standings.length > 0 && (
            <span className="mt-1 block font-mono text-xs">
              消化状況: {standings.filter((s) => s.played >= 2).length}/
              {standings.length} チーム
            </span>
          )}
        </p>
      )}
    </Card>
  );
}

export default function BracketPage() {
  const { admin } = useAdmin();
  const teamsState = useTeams();
  const matchesState = useMatches();

  if (teamsState.error === "unconfigured") return <SetupNotice />;

  const teams = teamsState.data ?? [];
  const matches = matchesState.data ?? [];
  const refreshAll = () => {
    teamsState.refresh();
    matchesState.refresh();
  };

  return (
    <div className="space-y-6">
      <section>
        <SectionTitle>トーナメント</SectionTitle>
        <p className="mb-3 text-sm text-muted">
          リーグ戦の順位をもとに「1位 vs 4位」「2位 vs 3位」→ 決勝のトーナメント表を自動生成します。
        </p>
        {teamsState.loading || matchesState.loading ? (
          <EmptyState>読み込み中…</EmptyState>
        ) : (
          <div className="space-y-3">
            {BLOCKS.map((b) => (
              <BlockBracket
                key={b}
                block={b}
                teams={teams}
                matches={matches}
                admin={admin}
                onChanged={refreshAll}
              />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
