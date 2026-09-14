"use client";

import { useMemo, useState } from "react";
import { useAdmin } from "@/components/AdminContext";
import {
  AdminBadge,
  Card,
  EmptyState,
  ErrorText,
  GhostButton,
  PrimaryButton,
  SectionTitle,
  SetupNotice,
  selectClass,
} from "@/components/ui";
import { postJson, useMatches, useTeams } from "@/lib/hooks";
import { computeStandings, isFinished } from "@/lib/standings";
import { BLOCKS, type Block, type Match, type Team } from "@/lib/types";

function BlockTabs({
  value,
  onChange,
}: {
  value: Block;
  onChange: (b: Block) => void;
}) {
  return (
    <div className="flex gap-1.5">
      {BLOCKS.map((b) => (
        <button
          key={b}
          onClick={() => onChange(b)}
          className={`flex-1 rounded-md border py-2.5 font-mono text-sm font-medium transition-colors ${
            value === b
              ? "border-navy bg-navy text-white"
              : "border-line bg-white text-muted hover:border-navy hover:text-ink"
          }`}
        >
          {b}
        </button>
      ))}
    </div>
  );
}

function StandingsTable({
  teams,
  matches,
  block,
}: {
  teams: Team[];
  matches: Match[];
  block: Block;
}) {
  const standings = computeStandings(teams, matches, block);

  if (standings.length === 0) {
    return <EmptyState>このブロックにはまだチームが割り当てられていません</EmptyState>;
  }

  return (
    <Card className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-line text-left font-mono text-xs text-muted">
            <th className="px-3 py-2.5 font-medium">#</th>
            <th className="px-3 py-2.5 font-medium">チーム</th>
            <th className="px-2 py-2.5 text-center font-medium">勝</th>
            <th className="px-2 py-2.5 text-center font-medium">敗</th>
            <th className="px-3 py-2.5 text-right font-medium">得失</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-line">
          {standings.map((s, i) => (
            <tr key={s.team.id} className={i === 0 && s.played > 0 ? "bg-amber/10" : ""}>
              <td className="px-3 py-2.5 font-mono font-medium text-amber-deep">
                {i + 1}
              </td>
              <td className="px-3 py-2.5 font-medium">{s.team.name}</td>
              <td className="px-2 py-2.5 text-center font-mono">{s.wins}</td>
              <td className="px-2 py-2.5 text-center font-mono">{s.losses}</td>
              <td className="px-3 py-2.5 text-right font-mono">
                {s.diff > 0 ? `+${s.diff}` : s.diff}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </Card>
  );
}

function ScoreEditor({
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
    "w-14 rounded-md border border-line px-2 py-1.5 text-center font-mono text-sm outline-none focus:border-navy";

  return (
    <div className="mt-2 border-t border-dashed border-line pt-2">
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

function MatchCard({
  match,
  teamName,
  admin,
  onChanged,
}: {
  match: Match;
  teamName: (id: string | null) => string;
  admin: boolean;
  onChanged: () => void;
}) {
  const finished = isFinished(match);
  const aWin = finished && (match.score_a as number) > (match.score_b as number);
  const bWin = finished && (match.score_b as number) > (match.score_a as number);

  const remove = async () => {
    if (!window.confirm("この対戦カードを削除しますか？")) return;
    try {
      await postJson("/api/admin/matches", "DELETE", { id: match.id });
      onChanged();
    } catch {
      /* 一覧の再取得で状態が戻る */
    }
  };

  return (
    <Card className="p-3">
      <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-2">
        <span
          className={`truncate text-right text-sm ${aWin ? "font-semibold" : "font-medium"}`}
        >
          {teamName(match.team_a)}
        </span>
        <span className="rounded-md bg-paper px-2.5 py-1 font-mono text-sm">
          {finished ? (
            <>
              <span className={aWin ? "text-navy" : "text-muted"}>{match.score_a}</span>
              <span className="mx-1 text-muted">–</span>
              <span className={bWin ? "text-navy" : "text-muted"}>{match.score_b}</span>
            </>
          ) : (
            <span className="text-xs text-muted">未実施</span>
          )}
        </span>
        <span
          className={`truncate text-sm ${bWin ? "font-semibold" : "font-medium"}`}
        >
          {teamName(match.team_b)}
        </span>
      </div>
      {(match.time || match.court) && (
        <p className="mt-1.5 text-center font-mono text-xs text-muted">
          {match.time ?? ""}
          {match.time && match.court ? " / " : ""}
          {match.court ? `コート${match.court}` : ""}
        </p>
      )}
      {admin && (
        <>
          <ScoreEditor match={match} onSaved={onChanged} />
          <div className="mt-1.5 text-right">
            <button
              onClick={remove}
              className="text-xs text-muted underline-offset-2 hover:text-red-600 hover:underline"
            >
              削除
            </button>
          </div>
        </>
      )}
    </Card>
  );
}

function AddMatchForm({
  block,
  blockTeams,
  onAdded,
}: {
  block: Block;
  blockTeams: Team[];
  onAdded: () => void;
}) {
  const [teamA, setTeamA] = useState("");
  const [teamB, setTeamB] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const add = async () => {
    setBusy(true);
    setError(null);
    try {
      await postJson("/api/admin/matches", "POST", {
        round: "league",
        block,
        teamA,
        teamB,
      });
      setTeamA("");
      setTeamB("");
      onAdded();
    } catch (e) {
      setError(e instanceof Error ? e.message : "登録に失敗しました");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card className="border-amber bg-amber/10 p-4">
      <p className="mb-2 flex items-center gap-2 text-sm font-semibold">
        <AdminBadge /> 対戦カード追加（ブロック {block}）
      </p>
      <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-2">
        <select value={teamA} onChange={(e) => setTeamA(e.target.value)} className={selectClass}>
          <option value="">チームA</option>
          {blockTeams.map((t) => (
            <option key={t.id} value={t.id}>{t.name}</option>
          ))}
        </select>
        <span className="font-mono text-xs text-muted">vs</span>
        <select value={teamB} onChange={(e) => setTeamB(e.target.value)} className={selectClass}>
          <option value="">チームB</option>
          {blockTeams.map((t) => (
            <option key={t.id} value={t.id}>{t.name}</option>
          ))}
        </select>
      </div>
      {error && <p className="mt-2 text-sm text-red-700">{error}</p>}
      <PrimaryButton
        onClick={add}
        disabled={busy || !teamA || !teamB || teamA === teamB}
        className="mt-3 w-full"
      >
        {busy ? "登録中…" : "対戦カードを追加"}
      </PrimaryButton>
      <p className="mt-2 text-xs text-muted">
        リーグ戦は1チームあたり2試合（例: 1-2, 3-4, 1-3, 2-4）／15点先取・デュースなし
      </p>
    </Card>
  );
}

export default function ResultsPage() {
  const { admin } = useAdmin();
  const [block, setBlock] = useState<Block>("A");
  const teamsState = useTeams();
  const matchesState = useMatches();

  const teams = useMemo(() => teamsState.data ?? [], [teamsState.data]);
  const matches = useMemo(() => matchesState.data ?? [], [matchesState.data]);

  const teamName = (id: string | null) =>
    teams.find((t) => t.id === id)?.name ?? "不明なチーム";

  const blockTeams = teams.filter((t) => t.block === block);
  const blockMatches = matches.filter(
    (m) => m.round === "league" && m.block === block
  );

  if (teamsState.error === "unconfigured") return <SetupNotice />;

  const refreshAll = () => {
    teamsState.refresh();
    matchesState.refresh();
  };

  return (
    <div className="space-y-6">
      <BlockTabs value={block} onChange={setBlock} />

      <section>
        <SectionTitle>順位表 — ブロック {block}</SectionTitle>
        {teamsState.loading || matchesState.loading ? (
          <EmptyState>読み込み中…</EmptyState>
        ) : (
          <StandingsTable teams={teams} matches={matches} block={block} />
        )}
        <p className="mt-2 text-xs text-muted">
          勝ち数 → 得失点差 → 総得点の順で自動的に並べ替えられます。
        </p>
      </section>

      {admin && (
        <AddMatchForm block={block} blockTeams={blockTeams} onAdded={refreshAll} />
      )}

      <section>
        <SectionTitle>リーグ戦 — ブロック {block}</SectionTitle>
        {blockMatches.length === 0 ? (
          <EmptyState>まだ対戦カードがありません</EmptyState>
        ) : (
          <div className="space-y-2">
            {blockMatches.map((m) => (
              <MatchCard
                key={m.id}
                match={m}
                teamName={teamName}
                admin={admin}
                onChanged={refreshAll}
              />
            ))}
          </div>
        )}
        <ErrorText>{matchesState.error !== "unconfigured" ? matchesState.error : null}</ErrorText>
      </section>
    </div>
  );
}
