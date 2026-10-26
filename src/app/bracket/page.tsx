"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useAdmin } from "@/components/AdminContext";
import MatchEditor from "@/components/admin/MatchEditor";
import TieBreaker from "@/components/admin/TieBreaker";
import ScoreEditor from "@/components/ScoreEditor";
import {
  AdminBadge,
  Card,
  EmptyState,
  GhostButton,
  SectionTitle,
  SetupNotice,
} from "@/components/ui";
import {
  computeBracket,
  ROUND_LABEL,
  SLOT_LABEL,
  type BracketPlan,
  type SlotPlan,
} from "@/lib/bracket";
import { postJson, useMatches, useNow, useSettings, useTeams } from "@/lib/hooks";
import { computeLive, isEventDay, jstParts } from "@/lib/live";
import { DEFAULT_SCHEDULE, type Match, type SlotId, type Team } from "@/lib/types";

// ---- トーナメント表（1回戦 → 準々決勝 → 準決勝 → 決勝）の寸法 ----
const BOX_W = 176;
const ROW_H = 30;
const BOX_H = ROW_H * 2;
const META_H = 16;
const PITCH = 92; // 準々決勝1行ぶんの縦の間隔
const COL_GAP = 36;
const TITLE_H = 24;

const COLUMN: Record<SlotId, number> = {
  "R1-1": 0,
  "R1-2": 0,
  QF1: 1,
  QF2: 1,
  QF3: 1,
  QF4: 1,
  SF1: 2,
  SF2: 2,
  F: 3,
};

// 縦位置（QF1行=0 を基準に PITCH 単位）。
// 上から QF1, QF4, QF3, QF2。1回戦は勝ち上がる準々決勝と同じ高さに置く。
const ROW: Record<SlotId, number> = {
  "R1-2": 0,
  QF1: 0,
  QF4: 1,
  QF3: 2,
  QF2: 3,
  "R1-1": 3,
  SF1: 0.5,
  SF2: 2.5,
  F: 1.5,
};

// 勝者が進む先
const EDGES: [SlotId, SlotId][] = [
  ["R1-2", "QF1"],
  ["R1-1", "QF2"],
  ["QF1", "SF1"],
  ["QF4", "SF1"],
  ["QF3", "SF2"],
  ["QF2", "SF2"],
  ["SF1", "F"],
  ["SF2", "F"],
];

const W = 4 * BOX_W + 3 * COL_GAP;
const H = TITLE_H + 3 * PITCH + META_H + BOX_H + 4;

const xOf = (slot: SlotId) => COLUMN[slot] * (BOX_W + COL_GAP);
const yOf = (slot: SlotId) => TITLE_H + ROW[slot] * PITCH;
const centerY = (slot: SlotId) => yOf(slot) + META_H + BOX_H / 2;

const COLUMN_TITLES = ["R1", "QF", "SF", "F"] as const;

function TeamRow({
  team,
  label,
  seed,
  score,
  isWinner,
  isLoser,
  top,
}: {
  team: Team | null;
  label: string;
  seed: number | null;
  score: number | null;
  isWinner: boolean;
  isLoser: boolean;
  top: boolean;
}) {
  return (
    <div
      className={`flex items-center gap-1.5 px-2 ${top ? "border-b border-line" : ""} ${
        isWinner ? "bg-amber/20" : "bg-white"
      }`}
      style={{ height: ROW_H }}
    >
      {seed !== null && (
        <span className="w-5 shrink-0 font-mono text-[10px] text-amber-deep">
          #{seed}
        </span>
      )}
      <span
        className={`min-w-0 flex-1 truncate text-[13px] ${
          team
            ? isWinner
              ? "font-semibold text-navy"
              : isLoser
                ? "font-medium text-muted"
                : "font-medium"
            : "text-[11px] text-muted"
        }`}
      >
        {team ? team.name : label}
      </span>
      {score !== null && (
        <span
          className={`shrink-0 font-mono text-[13px] tabular-nums ${
            isWinner ? "font-medium text-navy" : "text-muted"
          }`}
        >
          {score}
        </span>
      )}
    </div>
  );
}

function MatchBox({
  plan,
  seedOf,
  live,
}: {
  plan: SlotPlan;
  seedOf: (t: Team | null) => number | null;
  live: boolean;
}) {
  const m = plan.match;
  const finished = m !== null && m.score_a !== null && m.score_b !== null;
  const sa = finished ? (m.score_a as number) : null;
  const sb = finished ? (m.score_b as number) : null;
  const aWin = plan.winner !== null && plan.winner.id === plan.teamA?.id;
  const bWin = plan.winner !== null && plan.winner.id === plan.teamB?.id;

  return (
    <div
      className="absolute"
      style={{ left: xOf(plan.slot), top: yOf(plan.slot), width: BOX_W }}
    >
      <div
        className="flex items-end justify-between px-0.5 font-mono text-[10px] text-muted"
        style={{ height: META_H }}
      >
        <span className="truncate">{SLOT_LABEL[plan.slot]}</span>
        {live ? (
          <span className="shrink-0 pl-1 font-medium text-amber-deep">
            ● LIVE{m?.court ? ` C${m.court}` : ""}
          </span>
        ) : (
          m &&
          (m.time || m.court) && (
            <span className="shrink-0 pl-1 text-navy">
              {m.time ?? ""}
              {m.court ? ` C${m.court}` : ""}
            </span>
          )
        )}
      </div>
      <div
        className={`overflow-hidden rounded-md border ${
          live ? "border-amber ring-2 ring-amber" : "border-line"
        }`}
      >
        <TeamRow
          team={plan.teamA}
          label={plan.labelA}
          seed={seedOf(plan.teamA)}
          score={sa}
          isWinner={aWin}
          isLoser={bWin}
          top
        />
        <TeamRow
          team={plan.teamB}
          label={plan.labelB}
          seed={seedOf(plan.teamB)}
          score={sb}
          isWinner={bWin}
          isLoser={aWin}
          top={false}
        />
      </div>
    </div>
  );
}

function BracketDiagram({
  plan,
  liveIds,
}: {
  plan: BracketPlan;
  liveIds: Set<string>;
}) {
  const seedByTeam = new Map(plan.seeds.map((s) => [s.standing.team.id, s.seed]));
  const seedOf = (t: Team | null) => (t ? (seedByTeam.get(t.id) ?? null) : null);
  const winners = new Set(plan.slots.filter((s) => s.winner).map((s) => s.slot));

  // パソコンでは本文の幅(48rem)を超えて広げ、表の全体が横スクロールなしで見えるようにする。
  // スマホでは画面幅に収めて、表の中だけ横スクロールする。
  return (
    <div className="relative left-1/2 w-[min(56rem,calc(100vw-2rem))] -translate-x-1/2">
    <div className="overflow-x-auto rounded-lg border border-line bg-white p-3">
      <div className="relative" style={{ width: W, height: H }}>
        {COLUMN_TITLES.map((key, c) => (
          <div
            key={key}
            className="absolute text-center font-mono text-[10px] tracking-widest text-muted"
            style={{ left: c * (BOX_W + COL_GAP), top: 0, width: BOX_W }}
          >
            {ROUND_LABEL[key]}
          </div>
        ))}
        <svg
          width={W}
          height={H}
          className="pointer-events-none absolute left-0 top-0"
          aria-hidden
        >
          {EDGES.map(([from, to]) => {
            const x1 = xOf(from) + BOX_W;
            const y1 = centerY(from);
            const x2 = xOf(to);
            const y2 = centerY(to);
            const xm = x1 + COL_GAP / 2;
            return (
              <path
                key={`${from}-${to}`}
                d={`M${x1} ${y1} H${xm} V${y2} H${x2}`}
                fill="none"
                stroke={winners.has(from) ? "#16213e" : "#c9c6b6"}
                strokeWidth={2}
              />
            );
          })}
        </svg>
        {plan.slots.map((s) => (
          <MatchBox
            key={s.slot}
            plan={s}
            seedOf={seedOf}
            live={s.match !== null && liveIds.has(s.match.id)}
          />
        ))}
      </div>
    </div>
    </div>
  );
}

function SeedTable({ plan }: { plan: BracketPlan }) {
  return (
    <Card className="divide-y divide-line">
      {plan.seeds.map((s) => (
        <div key={s.seed} className="flex items-center gap-3 px-4 py-2.5 text-sm">
          <span className="w-6 font-mono text-xs font-medium text-amber-deep">
            #{s.seed}
          </span>
          <span className="min-w-0 flex-1 truncate font-medium">
            {s.standing.team.name}
          </span>
          <span className="shrink-0 font-mono text-[11px] text-muted">
            {s.block}組{s.blockRank}位 · {s.standing.wins}勝{s.standing.losses}敗 ·{" "}
            {s.standing.diff > 0 ? `+${s.standing.diff}` : s.standing.diff}
          </span>
        </div>
      ))}
    </Card>
  );
}

function PendingPanel({
  plan,
  admin,
  onChanged,
}: {
  plan: BracketPlan;
  admin: boolean;
  onChanged: () => void;
}) {
  const pct =
    plan.leagueTotal === 0
      ? 0
      : Math.round((plan.leagueFinished / plan.leagueTotal) * 100);
  return (
    <div className="space-y-3">
      <Card className="p-4">
        <p className="text-sm font-medium">
          リーグ戦が終わると、決勝トーナメントが自動で表示されます
        </p>
        <div className="mt-3 h-2 overflow-hidden rounded-full bg-paper">
          <div className="h-full bg-amber" style={{ width: `${pct}%` }} />
        </div>
        <p className="mt-2 font-mono text-xs text-muted">
          リーグ戦 {plan.leagueFinished} / {plan.leagueTotal} 試合 終了
          {plan.incompleteBlocks.length > 0 &&
            ` · 未完了ブロック: ${plan.incompleteBlocks.join(", ")}`}
        </p>
      </Card>
      {plan.ties.map((t) => (
        <TieBreaker
          key={`${t.title}-${t.group.standings.map((s) => s.team.id).join("-")}`}
          title={t.title}
          group={t.group}
          admin={admin}
          onSaved={onChanged}
        />
      ))}
    </div>
  );
}

function BracketAdmin({
  plan,
  matches,
  teams,
  courts,
  onChanged,
}: {
  plan: BracketPlan;
  matches: Match[];
  teams: Team[];
  courts: number;
  onChanged: () => void;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const sync = async () => {
    setBusy(true);
    setError(null);
    try {
      await postJson("/api/admin/bracket/sync", "POST");
      onChanged();
    } catch (e) {
      setError(e instanceof Error ? e.message : "更新に失敗しました");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-3 rounded-lg border border-amber bg-amber/10 p-4">
      <div className="flex items-center justify-between gap-2">
        <p className="flex items-center gap-2 text-sm font-semibold">
          <AdminBadge /> トーナメント運営
        </p>
        <GhostButton onClick={sync} disabled={busy} className="px-3 py-1.5 text-xs">
          {busy ? "更新中…" : "組み合わせを更新"}
        </GhostButton>
      </div>
      {error && <p className="text-sm text-red-700">{error}</p>}
      <p className="text-xs text-muted">
        試合の結果を保存すると、勝者が次の試合に自動で進みます。結果を直すと、その先の試合の結果は取り消されます。
      </p>
      {plan.slots.map((s) => (
        <div key={s.slot} className="space-y-1.5">
          <p className="font-mono text-[11px] text-amber-deep">
            {SLOT_LABEL[s.slot]}
            <span className="ml-2 text-muted">
              {s.teamA?.name ?? "未定"} vs {s.teamB?.name ?? "未定"}
            </span>
          </p>
          {s.match ? (
            <>
              {s.teamA && s.teamB && (
                <div className="rounded-md border border-line bg-white p-2.5">
                  <ScoreEditor match={s.match} onSaved={onChanged} />
                </div>
              )}
              <MatchEditor
                key={`${s.match.id}-${s.match.time}-${s.match.court}`}
                match={s.match}
                allMatches={matches}
                teams={teams}
                courts={courts}
                editableTeams={false}
                onChanged={onChanged}
              />
            </>
          ) : (
            <p className="text-xs text-muted">試合を作成中です。「組み合わせを更新」を押してください。</p>
          )}
        </div>
      ))}
    </div>
  );
}

export default function BracketPage() {
  const { admin } = useAdmin();
  const teamsState = useTeams();
  const matchesState = useMatches();
  const settingsState = useSettings();
  const [syncError, setSyncError] = useState<string | null>(null);

  const teams = useMemo(() => teamsState.data ?? [], [teamsState.data]);
  const matches = useMemo(() => matchesState.data ?? [], [matchesState.data]);
  const plan = useMemo(() => computeBracket(teams, matches), [teams, matches]);

  // 大会当日、いま進行中のトーナメントの試合を強調表示する
  const now = useNow(10_000);
  const slotMinutes = settingsState.data?.slot_minutes ?? DEFAULT_SCHEDULE.slotMinutes;
  const liveIds = useMemo(() => {
    if (now === null || !isEventDay(now)) return new Set<string>();
    const live = computeLive(matches, jstParts(now).minutes, slotMinutes);
    return new Set(live.playing.map((x) => x.match.id));
  }, [now, matches, slotMinutes]);

  const refreshAll = () => {
    teamsState.refresh();
    matchesState.refresh();
  };

  // 運営が開いたとき、トーナメントの試合がまだ作られていなければ自動で作る（組み合わせごとに1回だけ）
  const missing = plan.ready
    ? plan.slots.filter((s) => !s.match).map((s) => s.slot).join(",")
    : "";
  const tried = useRef("");
  useEffect(() => {
    if (!admin || !missing || tried.current === missing) return;
    tried.current = missing;
    postJson("/api/admin/bracket/sync", "POST")
      .then(() => {
        teamsState.refresh();
        matchesState.refresh();
      })
      .catch((e) => setSyncError(e instanceof Error ? e.message : "更新に失敗しました"));
    // refresh 関数は毎回作り直されるため依存に含めない
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [admin, missing]);

  if (teamsState.error === "unconfigured") return <SetupNotice />;

  const loading = teamsState.loading || matchesState.loading;
  const courts = settingsState.data?.courts ?? DEFAULT_SCHEDULE.courts;

  return (
    <div className="space-y-6">
      <section>
        <SectionTitle>決勝トーナメント</SectionTitle>
        <p className="mb-3 text-sm text-muted">
          各ブロック上位2チーム（計10チーム）による1本のトーナメントです。ブロック1位の5チームと2位の最上位1チームがシードで準々決勝から、残り4チームは1回戦から始まります。
        </p>
        {loading ? (
          <EmptyState>読み込み中…</EmptyState>
        ) : !plan.ready ? (
          <PendingPanel plan={plan} admin={admin} onChanged={refreshAll} />
        ) : (
          <div className="space-y-4">
            {plan.champion && (
              <div className="flex items-center justify-center gap-2 rounded-lg bg-navy px-3 py-3">
                <span className="font-mono text-[10px] tracking-widest text-amber">
                  CHAMPION
                </span>
                <span className="text-base font-semibold text-white">
                  {plan.champion.name}
                </span>
              </div>
            )}
            <BracketDiagram plan={plan} liveIds={liveIds} />
            <p className="text-xs text-muted">
              横にスクロールして全体を見られます。#の数字はシード順位です。
            </p>
          </div>
        )}
      </section>

      {!loading && plan.ready && (
        <section>
          <SectionTitle>シード順位</SectionTitle>
          <p className="mb-2 text-xs text-muted">
            各ブロック1位の5チームを勝ち数 → 得失点差 → 総得点で順位づけ（#1〜5）。2位の5チームも同じ基準で比べ、最上位が#6、残りが#7〜10です。
          </p>
          <SeedTable plan={plan} />
        </section>
      )}

      {admin && !loading && plan.ready && (
        <>
          {syncError && <p className="text-sm text-red-700">{syncError}</p>}
          <BracketAdmin
            plan={plan}
            matches={matches}
            teams={teams}
            courts={courts}
            onChanged={refreshAll}
          />
        </>
      )}
    </div>
  );
}
