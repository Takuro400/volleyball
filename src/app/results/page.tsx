"use client";

import { useMemo, useState } from "react";
import { useAdmin } from "@/components/AdminContext";
import {
  AdminBadge,
  Card,
  EmptyState,
  ErrorText,
  PrimaryButton,
  SectionTitle,
  SetupNotice,
  selectClass,
} from "@/components/ui";
import ScoreEditor from "@/components/ScoreEditor";
import TieBreaker from "@/components/admin/TieBreaker";
import { postJson, useMatches, useTeams } from "@/lib/hooks";
import {
  blockComplete,
  computeStandings,
  findTieGroups,
  isFinished,
} from "@/lib/standings";
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
  admin,
  onChanged,
}: {
  teams: Team[];
  matches: Match[];
  block: Block;
  admin: boolean;
  onChanged: () => void;
}) {
  const standings = computeStandings(teams, matches, block);

  if (standings.length === 0) {
    return <EmptyState>このブロックにはまだチームが割り当てられていません</EmptyState>;
  }

  // 総当たりが終わった後、上位2チーム(決勝トーナメント進出)の判定に影響する同率だけ手動決定の対象にする
  const ties = blockComplete(standings)
    ? findTieGroups(standings).filter(
        (g) =>
          g.startIndex <= 1 &&
          g.startIndex + g.standings.length - 1 >= 1 &&
          !g.resolved
      )
    : [];

  return (
    <div className="space-y-2">
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
    {ties.map((g) => (
      <TieBreaker
        key={g.standings.map((s) => s.team.id).join("-")}
        title={`ブロック${block}`}
        group={g}
        admin={admin}
        onSaved={onChanged}
      />
    ))}
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
          <div className="mt-2 border-t border-dashed border-line pt-2">
            <ScoreEditor match={match} onSaved={onChanged} />
          </div>
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
        通常は「試合予定」ページで総当たりを自動生成します。ここでは足りない試合を1つずつ追加できます。
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
  const blockMatches = matches
    .filter((m) => m.round === "league" && m.block === block)
    .sort((a, b) => (a.time ?? "99:99").localeCompare(b.time ?? "99:99"));

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
          <StandingsTable
            teams={teams}
            matches={matches}
            block={block}
            admin={admin}
            onChanged={refreshAll}
          />
        )}
        <p className="mt-2 text-xs text-muted">
          勝ち数 → 得失点差 → 総得点の順で自動的に並べ替えられます。それでも同率のときは運営が順位を決定します。
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
