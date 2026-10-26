import type { Match } from "./types";
import { EVENT_DATE_ISO } from "./types";

// 「いま行われている試合」の判定。画面にもサーバーにも依存しない純粋なロジック。
//
//  - 試合の開始 = matches.time。終わりは「同じコートの次の試合の開始」
//    （ただし最大で開始 + 枠の2倍）。次が無ければ「開始 + 1試合の枠(分)」。
//  - 結果(スコア)が入った試合は終了扱い。
//  - 大会当日(日本時間)だけ判定する。

export type LiveMatch = { match: Match; startMin: number; endMin: number };

export type LiveBoard = {
  playing: LiveMatch[]; // 進行中
  awaiting: LiveMatch[]; // 終了予定を過ぎたが、結果が未入力
  next: LiveMatch[]; // コートごとの次の試合
  anyScheduled: boolean;
};

const JST_OFFSET_MS = 9 * 60 * 60 * 1000;

// "13:24" → 804。形式が違えば null
export function toMinutes(time: string | null): number | null {
  if (!time) return null;
  const m = /^(\d{1,2}):(\d{2})/.exec(time);
  if (!m) return null;
  return Number(m[1]) * 60 + Number(m[2]);
}

// 日本時間での「日付」と「0時からの分」
export function jstParts(nowMs: number): { date: string; minutes: number } {
  const d = new Date(nowMs + JST_OFFSET_MS);
  return {
    date: d.toISOString().slice(0, 10),
    minutes: d.getUTCHours() * 60 + d.getUTCMinutes(),
  };
}

export const EVENT_DATE = EVENT_DATE_ISO.slice(0, 10);

export function isEventDay(nowMs: number): boolean {
  return jstParts(nowMs).date === EVENT_DATE;
}

const isFinished = (m: Match) => m.score_a !== null && m.score_b !== null;

export function computeLive(
  matches: Match[],
  nowMin: number,
  slotMinutes: number
): LiveBoard {
  const scheduled = matches
    .map((match) => ({ match, startMin: toMinutes(match.time) }))
    .filter((x): x is { match: Match; startMin: number } => x.startMin !== null)
    .sort((a, b) => a.startMin - b.startMin);

  const withEnd: LiveMatch[] = scheduled.map((s) => {
    const sameCourtLater = scheduled.find(
      (o) =>
        o.match.id !== s.match.id &&
        o.match.court !== null &&
        o.match.court === s.match.court &&
        o.startMin > s.startMin
    );
    // 時間制限のない準決勝・決勝は枠より長引くので、最大で枠の2倍まで進行中とみなす
    const cap = s.startMin + slotMinutes * 2;
    const end = sameCourtLater
      ? Math.min(sameCourtLater.startMin, cap)
      : s.startMin + slotMinutes;
    return { match: s.match, startMin: s.startMin, endMin: end };
  });

  const open = withEnd.filter((x) => !isFinished(x.match));
  const playing = open.filter((x) => x.startMin <= nowMin && nowMin < x.endMin);
  const awaiting = open.filter((x) => x.endMin <= nowMin);

  // コートごとに、これから始まる最初の試合
  const next: LiveMatch[] = [];
  const seen = new Set<string>();
  for (const x of open) {
    if (x.startMin <= nowMin) continue;
    const key = x.match.court ?? "-";
    if (seen.has(key)) continue;
    seen.add(key);
    next.push(x);
  }

  return { playing, awaiting, next, anyScheduled: scheduled.length > 0 };
}

export function courtLabel(court: string | null): string {
  return court ? `C${court}` : "コート未定";
}

export function formatMinutes(min: number): string {
  const h = Math.floor(min / 60) % 24;
  return `${String(h).padStart(2, "0")}:${String(min % 60).padStart(2, "0")}`;
}
