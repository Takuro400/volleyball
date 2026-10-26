"use client";

import { SLOT_LABEL } from "@/lib/bracket";
import { useNow } from "@/lib/hooks";
import {
  computeLive,
  courtLabel,
  formatMinutes,
  isEventDay,
  jstParts,
  type LiveMatch,
} from "@/lib/live";
import type { Match, Team } from "@/lib/types";
import { Card } from "./ui";

function roundText(m: Match): string {
  if (m.round === "bracket") {
    return m.slot ? `決勝トーナメント ${SLOT_LABEL[m.slot]}` : "決勝トーナメント";
  }
  return `リーグ戦${m.block ? ` ブロック${m.block}` : ""}`;
}

// 大会当日だけ表示。いま行われている試合を、コートごとに見られる。
// 試合の開始時間(matches.time)と現在時刻から判定し、結果(スコア)が入ると終了扱いになる。
export default function LiveBoard({
  matches,
  teams,
  slotMinutes,
}: {
  matches: Match[];
  teams: Team[];
  slotMinutes: number;
}) {
  const now = useNow(10_000);
  if (now === null || !isEventDay(now)) return null;

  const { minutes } = jstParts(now);
  const live = computeLive(matches, minutes, slotMinutes);
  if (!live.anyScheduled) return null;

  const nameOf = (id: string | null) =>
    id === null ? "未定" : (teams.find((t) => t.id === id)?.name ?? "不明なチーム");

  const versus = (m: Match) => `${nameOf(m.team_a)} vs ${nameOf(m.team_b)}`;
  const byCourt = (a: LiveMatch, b: LiveMatch) =>
    (a.match.court ?? "").localeCompare(b.match.court ?? "", undefined, { numeric: true });
  const playing = [...live.playing].sort(byCourt);
  const awaiting = live.awaiting.slice(-6);

  return (
    <Card className="border-amber p-4" >
      <div className="flex items-center justify-between gap-2">
        <p className="flex items-center gap-2 font-mono text-xs font-medium tracking-widest text-amber-deep">
          <span className="relative flex h-2.5 w-2.5">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-amber opacity-75" />
            <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-amber" />
          </span>
          LIVE
        </p>
        <p className="font-mono text-xs text-muted">{formatMinutes(minutes)} 現在</p>
      </div>
      <h2 className="mt-1 font-display text-base font-bold">いまの試合</h2>

      <div aria-live="polite" className="mt-3 space-y-2">
        {playing.length === 0 ? (
          <p className="rounded-md bg-paper px-3 py-3 text-sm text-muted">
            いま進行中の試合はありません
          </p>
        ) : (
          playing.map((x) => (
            <div
              key={x.match.id}
              className="flex items-center gap-3 rounded-md border border-amber bg-amber/10 px-3 py-2.5"
            >
              <span className="shrink-0 rounded-md bg-navy px-2 py-1 font-mono text-xs font-medium text-white">
                {courtLabel(x.match.court)}
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold">{versus(x.match)}</p>
                <p className="truncate text-xs text-muted">{roundText(x.match)}</p>
              </div>
              <span className="shrink-0 font-mono text-xs text-navy">
                {formatMinutes(x.startMin)}〜
              </span>
            </div>
          ))
        )}
      </div>

      {live.next.length > 0 && (
        <div className="mt-4">
          <p className="mb-1.5 font-mono text-[11px] tracking-widest text-muted">
            NEXT — コートごとの次の試合
          </p>
          <ul className="divide-y divide-line rounded-md border border-line">
            {live.next.sort(byCourt).map((x) => (
              <li key={x.match.id} className="flex items-center gap-3 px-3 py-2 text-sm">
                <span className="w-12 shrink-0 font-mono text-xs text-navy">
                  {formatMinutes(x.startMin)}
                </span>
                <span className="w-9 shrink-0 font-mono text-xs text-muted">
                  {courtLabel(x.match.court)}
                </span>
                <span className="min-w-0 flex-1 truncate">{versus(x.match)}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {awaiting.length > 0 && (
        <div className="mt-4">
          <p className="mb-1.5 font-mono text-[11px] tracking-widest text-muted">
            結果入力待ち
          </p>
          <ul className="space-y-1">
            {awaiting.map((x) => (
              <li key={x.match.id} className="flex items-center gap-2 text-xs text-muted">
                <span className="font-mono">{formatMinutes(x.startMin)}</span>
                <span className="font-mono">{courtLabel(x.match.court)}</span>
                <span className="truncate">{versus(x.match)}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
      <p className="mt-3 text-[11px] text-muted">
        試合の時間と結果から自動で表示します。画面は自動で更新されます。
      </p>
    </Card>
  );
}
