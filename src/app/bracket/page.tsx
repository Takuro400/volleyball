"use client";

import { useState } from "react";
import { useAdmin } from "@/components/AdminContext";
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

function SeedMatchRow({
  seedA,
  seedB,
  nameA,
  nameB,
  dbMatch,
}: {
  seedA: number;
  seedB: number;
  nameA: string;
  nameB: string;
  dbMatch?: Match;
}) {
  const finished = dbMatch && isFinished(dbMatch);
  return (
    <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-2 px-4 py-3">
      <div className="text-right">
        <span className="mr-1.5 font-mono text-[10px] text-amber-deep">
          {seedA}位
        </span>
        <span className="text-sm font-medium">{nameA}</span>
      </div>
      <span className="rounded-md bg-paper px-2.5 py-1 font-mono text-sm">
        {finished ? (
          `${dbMatch!.score_a} – ${dbMatch!.score_b}`
        ) : (
          <span className="text-xs text-muted">vs</span>
        )}
      </span>
      <div>
        <span className="mr-1.5 font-mono text-[10px] text-amber-deep">
          {seedB}位
        </span>
        <span className="text-sm font-medium">{nameB}</span>
      </div>
    </div>
  );
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

  // 登録済みトーナメント試合をシード組み合わせに対応付ける
  const findDbMatch = (idA: string, idB: string) =>
    bracketMatches.find(
      (m) =>
        (m.team_a === idA && m.team_b === idB) ||
        (m.team_a === idB && m.team_b === idA)
    );

  const register = async () => {
    if (
      !window.confirm(
        `ブロック ${block} の初戦（1位vs4位・2位vs3位）をトーナメント試合として登録しますか？`
      )
    )
      return;
    setBusy(true);
    try {
      await postJson("/api/admin/matches", "POST", {
        round: "bracket",
        block,
        teamA: standings[0].team.id,
        teamB: standings[3].team.id,
      });
      await postJson("/api/admin/matches", "POST", {
        round: "bracket",
        block,
        teamA: standings[1].team.id,
        teamB: standings[2].team.id,
      });
      onChanged();
    } finally {
      setBusy(false);
    }
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
        <>
          <div className="divide-y divide-line">
            <SeedMatchRow
              seedA={1}
              seedB={4}
              nameA={standings[0].team.name}
              nameB={standings[3].team.name}
              dbMatch={findDbMatch(standings[0].team.id, standings[3].team.id)}
            />
            <SeedMatchRow
              seedA={2}
              seedB={3}
              nameA={standings[1].team.name}
              nameB={standings[2].team.name}
              dbMatch={findDbMatch(standings[1].team.id, standings[2].team.id)}
            />
          </div>
          {admin && bracketMatches.length === 0 && (
            <div className="border-t border-line p-3">
              <PrimaryButton onClick={register} disabled={busy} className="w-full">
                <span className="mr-2 inline-flex align-middle"><AdminBadge /></span>
                {busy ? "登録中…" : "初戦をトーナメント試合として登録"}
              </PrimaryButton>
            </div>
          )}
        </>
      ) : (
        <p className="px-4 py-5 text-center text-sm text-muted">
          リーグ戦（各チーム2試合）が終了すると
          <br />
          初戦の組み合わせが自動で表示されます
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
        <SectionTitle>トーナメント初戦</SectionTitle>
        <p className="mb-3 text-sm text-muted">
          各ブロックのリーグ戦順位から「1位 vs 4位」「2位 vs 3位」の組み合わせを自動生成します。
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
