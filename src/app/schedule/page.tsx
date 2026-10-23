"use client";

import { useMemo, useState } from "react";
import { useAdmin } from "@/components/AdminContext";
import {
  AdminBadge,
  Card,
  EmptyState,
  PrimaryButton,
  SectionTitle,
  SetupNotice,
  inputClass,
  selectClass,
} from "@/components/ui";
import LeagueGenerator from "@/components/admin/LeagueGenerator";
import MatchEditor from "@/components/admin/MatchEditor";
import { SLOT_LABEL } from "@/lib/bracket";
import { postJson, useMatches, useSettings, useTeams } from "@/lib/hooks";
import { isFinished } from "@/lib/standings";
import { BLOCKS, DEFAULT_SCHEDULE, type Match, type Team } from "@/lib/types";

function roundLabel(m: Pick<Match, "round" | "slot">) {
  if (m.round === "bracket") {
    return m.slot ? `決勝トーナメント ${SLOT_LABEL[m.slot]}` : "決勝トーナメント";
  }
  return "リーグ戦";
}

function NextMatch({
  teamId,
  teams,
  matches,
}: {
  teamId: string;
  teams: Team[];
  matches: Match[];
}) {
  const teamName = (id: string | null) =>
    id === null ? "未定" : (teams.find((t) => t.id === id)?.name ?? "不明なチーム");

  const upcoming = matches
    .filter(
      (m) =>
        (m.team_a === teamId || m.team_b === teamId) &&
        m.time !== null &&
        !isFinished(m)
    )
    .sort((a, b) => (a.time ?? "").localeCompare(b.time ?? ""));

  if (upcoming.length === 0) {
    return (
      <EmptyState>
        このチームの試合予定はまだ登録されていません
      </EmptyState>
    );
  }

  const [next, ...rest] = upcoming;
  const opponent = next.team_a === teamId ? next.team_b : next.team_a;

  return (
    <div className="space-y-3">
      <Card className="bg-navy p-5 text-white">
        <p className="font-mono text-xs tracking-widest text-amber">
          NEXT MATCH — {roundLabel(next)}
          {next.block ? ` / ブロック${next.block}` : ""}
        </p>
        <div className="mt-3 flex items-end justify-between gap-3">
          <div>
            <p className="font-display text-4xl font-bold tabular-nums">
              {next.time}
            </p>
            {next.court && (
              <p className="mt-1 font-mono text-sm text-white/70">
                コート {next.court}
              </p>
            )}
          </div>
          <div className="text-right">
            <p className="text-xs text-white/60">対戦相手</p>
            <p className="text-lg font-semibold">{teamName(opponent)}</p>
          </div>
        </div>
      </Card>
      {rest.length > 0 && (
        <Card className="divide-y divide-line">
          {rest.map((m) => {
            const opp = m.team_a === teamId ? m.team_b : m.team_a;
            return (
              <div key={m.id} className="flex items-center justify-between px-4 py-3">
                <div className="text-sm">
                  <span className="font-medium">vs {teamName(opp)}</span>
                  <span className="ml-2 text-xs text-muted">{roundLabel(m)}</span>
                </div>
                <span className="font-mono text-sm text-muted">
                  {m.time}
                  {m.court ? ` / コート${m.court}` : ""}
                </span>
              </div>
            );
          })}
        </Card>
      )}
    </div>
  );
}

function ScheduleForm({
  teams,
  onAdded,
}: {
  teams: Team[];
  onAdded: () => void;
}) {
  const [teamA, setTeamA] = useState("");
  const [teamB, setTeamB] = useState("");
  const [time, setTime] = useState("");
  const [court, setCourt] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async () => {
    setBusy(true);
    setError(null);
    try {
      // ブロックは両チームが同じブロックのときのみ自動設定する
      const blockA = teams.find((t) => t.id === teamA)?.block ?? null;
      const blockB = teams.find((t) => t.id === teamB)?.block ?? null;
      await postJson("/api/admin/matches", "POST", {
        block: blockA && blockA === blockB ? blockA : null,
        teamA,
        teamB,
        time,
        court,
      });
      setTeamA("");
      setTeamB("");
      setTime("");
      setCourt("");
      onAdded();
    } catch (e) {
      setError(e instanceof Error ? e.message : "登録に失敗しました");
    } finally {
      setBusy(false);
    }
  };

  const teamOption = (t: Team) =>
    `${t.name}${t.block ? `（${t.block}）` : ""}`;

  return (
    <Card className="border-amber bg-amber/10 p-4">
      <p className="mb-3 flex items-center gap-2 text-sm font-semibold">
        <AdminBadge /> リーグ戦の試合を1つ追加
      </p>
      <div className="space-y-2">
        <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-2">
          <select value={teamA} onChange={(e) => setTeamA(e.target.value)} className={selectClass}>
            <option value="">チームA</option>
            {teams.map((t) => (
              <option key={t.id} value={t.id}>{teamOption(t)}</option>
            ))}
          </select>
          <span className="font-mono text-xs text-muted">vs</span>
          <select value={teamB} onChange={(e) => setTeamB(e.target.value)} className={selectClass}>
            <option value="">チームB</option>
            {teams.map((t) => (
              <option key={t.id} value={t.id}>{teamOption(t)}</option>
            ))}
          </select>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <input
            type="time"
            value={time}
            onChange={(e) => setTime(e.target.value)}
            className={inputClass}
            aria-label="開始時間"
          />
          <input
            value={court}
            onChange={(e) => setCourt(e.target.value)}
            placeholder="コート番号（例: 1）"
            className={inputClass}
            maxLength={10}
          />
        </div>
      </div>
      {error && <p className="mt-2 text-sm text-red-700">{error}</p>}
      <PrimaryButton
        onClick={submit}
        disabled={busy || !teamA || !teamB || teamA === teamB || !time}
        className="mt-3 w-full"
      >
        {busy ? "登録中…" : "予定を登録"}
      </PrimaryButton>
    </Card>
  );
}

export default function SchedulePage() {
  const { admin } = useAdmin();
  const teamsState = useTeams();
  const matchesState = useMatches();
  const settingsState = useSettings();
  const [selectedTeam, setSelectedTeam] = useState("");

  const teams = useMemo(() => teamsState.data ?? [], [teamsState.data]);
  const matches = useMemo(() => matchesState.data ?? [], [matchesState.data]);

  if (teamsState.error === "unconfigured") return <SetupNotice />;

  const teamName = (id: string | null) =>
    id === null ? "未定" : (teams.find((t) => t.id === id)?.name ?? "不明なチーム");

  const byTimeThenCourt = (a: Match, b: Match) =>
    (a.time ?? "99:99").localeCompare(b.time ?? "99:99") ||
    (a.court ?? "").localeCompare(b.court ?? "", undefined, { numeric: true });

  const allScheduled = matches.filter((m) => m.time !== null).sort(byTimeThenCourt);
  const editable = [...matches].sort(byTimeThenCourt);
  const courts = settingsState.data?.courts ?? DEFAULT_SCHEDULE.courts;
  const leagueCount = matches.filter((m) => m.round === "league").length;
  const refreshAll = () => {
    teamsState.refresh();
    matchesState.refresh();
  };

  return (
    <div className="space-y-6">
      <section>
        <SectionTitle>次の試合を確認</SectionTitle>
        <select
          value={selectedTeam}
          onChange={(e) => setSelectedTeam(e.target.value)}
          className={selectClass}
        >
          <option value="">チームを選択してください</option>
          {[...BLOCKS, null].map((b) =>
            teams
              .filter((t) => t.block === b)
              .map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                  {b ? `（ブロック${b}）` : "（ブロック未定）"}
                </option>
              ))
          )}
        </select>
        {selectedTeam && (
          <div className="mt-3">
            <NextMatch teamId={selectedTeam} teams={teams} matches={matches} />
          </div>
        )}
      </section>

      {admin && !settingsState.loading && (
        <LeagueGenerator
          key={`${settingsState.data?.schedule_start}-${settingsState.data?.slot_minutes}-${settingsState.data?.courts}`}
          settings={settingsState.data}
          existingCount={leagueCount}
          onDone={() => {
            refreshAll();
            settingsState.refresh();
          }}
        />
      )}

      {admin && editable.length > 0 && (
        <details className="rounded-lg border border-amber bg-amber/10 p-4">
          <summary className="flex cursor-pointer items-center gap-2 text-sm font-semibold">
            <AdminBadge /> 試合の編集（時間・コート・対戦）{editable.length}試合
          </summary>
          <p className="mt-2 text-xs text-muted">
            自動生成した予定を手で直せます。結果の入力は「結果・順位」ページで行います。決勝トーナメントの試合は、対戦チームが順位と結果から自動で決まるため時間とコートのみ変更できます。
          </p>
          <div className="mt-3 space-y-2">
            {editable.map((m) => (
              <div key={`${m.id}-${m.time}-${m.court}-${m.team_a}-${m.team_b}`}>
                <p className="mb-1 font-mono text-[10px] text-muted">
                  {roundLabel(m)}
                </p>
                <MatchEditor
                  match={m}
                  allMatches={matches}
                  teams={teams}
                  courts={courts}
                  editableTeams={m.round === "league"}
                  onChanged={refreshAll}
                />
              </div>
            ))}
          </div>
        </details>
      )}

      {admin && <ScheduleForm teams={teams} onAdded={refreshAll} />}

      <section>
        <SectionTitle>全体スケジュール</SectionTitle>
        {matchesState.loading ? (
          <EmptyState>読み込み中…</EmptyState>
        ) : allScheduled.length === 0 ? (
          <EmptyState>試合予定はまだ登録されていません</EmptyState>
        ) : (
          <Card className="divide-y divide-line">
            {allScheduled.map((m) => (
              <div key={m.id} className="flex items-center justify-between gap-3 px-4 py-3">
                <div className="min-w-0 text-sm">
                  <p className="truncate font-medium">
                    {teamName(m.team_a)} vs {teamName(m.team_b)}
                  </p>
                  <p className="text-xs text-muted">
                    {roundLabel(m)}
                    {m.block ? ` / ブロック${m.block}` : ""}
                    {isFinished(m) ? " / 終了" : ""}
                  </p>
                </div>
                <span className="shrink-0 font-mono text-sm">
                  {m.time}
                  {m.court ? (
                    <span className="ml-2 text-muted">C{m.court}</span>
                  ) : null}
                </span>
              </div>
            ))}
          </Card>
        )}
      </section>
    </div>
  );
}
