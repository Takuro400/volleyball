import type { Block } from "./types";

// リーグ戦の総当たり対戦表と、時間・コートの自動割り当て。
// 画面にもサーバーにも依存しない純粋なロジック。

export type LeagueInput = { block: Block; teamIds: string[] }[];

export type LeagueOptions = {
  startTime: string; // "11:00"
  slotMinutes: number; // 1試合の枠（分）
  courts: number; // コート数
  seed?: number; // 試行の乱数シード（同じ入力なら同じ結果になる）
  attempts?: number;
};

export type PlannedMatch = {
  block: Block;
  teamA: string;
  teamB: string;
  time: string; // "HH:MM"
  court: string; // "1"〜
  slot: number; // 何番目の時間枠か（0始まり）
  round: number; // ブロック内の何ラウンド目か（1始まり）
};

export type LeaguePlan = {
  matches: PlannedMatch[];
  slots: number;
  endTime: string; // 最後の試合が終わる時刻
  backToBack: number; // 同じチームが連続して試合する回数（0が理想）
};

type Pair = { block: Block; round: number; a: string; b: string };

// ブロック内の総当たりをラウンドに分ける。
// 4チームは 1-2/3-4 → 1-3/2-4 → 1-4/2-3 の3ラウンド。それ以外はサークル法。
export function roundRobinRounds(ids: string[]): [string, string][][] {
  const n = ids.length;
  if (n < 2) return [];
  if (n === 4) {
    const idx: [number, number][][] = [
      [[0, 1], [2, 3]],
      [[0, 2], [1, 3]],
      [[0, 3], [1, 2]],
    ];
    return idx.map((r) => r.map(([i, j]) => [ids[i], ids[j]] as [string, string]));
  }
  const list: (string | null)[] = [...ids];
  if (n % 2 === 1) list.push(null); // 奇数は不戦枠を入れる
  const m = list.length;
  const rounds: [string, string][][] = [];
  for (let r = 0; r < m - 1; r++) {
    const round: [string, string][] = [];
    for (let i = 0; i < m / 2; i++) {
      const a = list[i];
      const b = list[m - 1 - i];
      if (a !== null && b !== null) round.push([a, b]);
    }
    rounds.push(round);
    list.splice(1, 0, list.pop() as string | null);
  }
  return rounds;
}

function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function addMinutes(time: string, minutes: number): string {
  const [h, m] = time.split(":").map(Number);
  const total = (h * 60 + m + minutes) % (24 * 60);
  return `${String(Math.floor(total / 60)).padStart(2, "0")}:${String(total % 60).padStart(2, "0")}`;
}

// 1回ぶんの割り当て。時間枠ごとに、連続出場になるチームを避けながら試合を選ぶ。
function buildOnce(
  pairs: Pair[],
  courts: number,
  rng: (() => number) | null
): number[][] {
  const remaining = new Map<string, number>();
  for (const p of pairs) {
    remaining.set(p.a, (remaining.get(p.a) ?? 0) + 1);
    remaining.set(p.b, (remaining.get(p.b) ?? 0) + 1);
  }
  const done = new Array<boolean>(pairs.length).fill(false);
  let left = pairs.length;
  const slots: number[][] = [];
  let prev = new Set<string>();
  let prev2 = new Set<string>();

  while (left > 0) {
    const chosen: number[] = [];
    const used = new Set<string>();
    while (chosen.length < courts) {
      let best = -1;
      let bestScore = Number.POSITIVE_INFINITY;
      for (let i = 0; i < pairs.length; i++) {
        if (done[i]) continue;
        const p = pairs[i];
        // 同じ時間枠に同じチームを2回入れない
        if (used.has(p.a) || used.has(p.b)) continue;
        let s = 0;
        if (prev.has(p.a)) s += 1000; // 前の枠にも出ていた＝連続
        if (prev.has(p.b)) s += 1000;
        if (prev2.has(p.a)) s += 20; // 2枠前に出ていたら少し避ける
        if (prev2.has(p.b)) s += 20;
        s -= 4 * ((remaining.get(p.a) ?? 0) + (remaining.get(p.b) ?? 0)); // 残り試合が多いチームを優先
        s += 3 * p.round; // 同じブロックは早いラウンドから
        if (rng) s += rng() * 30;
        s += i * 0.001; // 同点なら並び順で決める（再現性のため）
        if (s < bestScore) {
          bestScore = s;
          best = i;
        }
      }
      if (best < 0) break;
      chosen.push(best);
      done[best] = true;
      left--;
      used.add(pairs[best].a);
      used.add(pairs[best].b);
      remaining.set(pairs[best].a, (remaining.get(pairs[best].a) ?? 1) - 1);
      remaining.set(pairs[best].b, (remaining.get(pairs[best].b) ?? 1) - 1);
    }
    if (chosen.length === 0) break;
    slots.push(chosen);
    prev2 = prev;
    prev = used;
  }
  return slots;
}

function countBackToBack(pairs: Pair[], slots: number[][]): number {
  let count = 0;
  for (let k = 1; k < slots.length; k++) {
    const before = new Set<string>();
    for (const i of slots[k - 1]) {
      before.add(pairs[i].a);
      before.add(pairs[i].b);
    }
    for (const i of slots[k]) {
      if (before.has(pairs[i].a)) count++;
      if (before.has(pairs[i].b)) count++;
    }
  }
  return count;
}

export function generateLeague(
  input: LeagueInput,
  options: LeagueOptions
): LeaguePlan {
  const courts = Math.max(1, Math.floor(options.courts));
  const pairs: Pair[] = [];
  for (const { block, teamIds } of input) {
    roundRobinRounds(teamIds).forEach((round, r) => {
      for (const [a, b] of round) pairs.push({ block, round: r + 1, a, b });
    });
  }
  if (pairs.length === 0) {
    return { matches: [], slots: 0, endTime: options.startTime, backToBack: 0 };
  }

  const minSlots = Math.ceil(pairs.length / courts);
  const attempts = options.attempts ?? 300;
  const baseSeed = options.seed ?? 20261127;

  let best: number[][] | null = null;
  let bestScore: [number, number] = [Infinity, Infinity];
  for (let t = 0; t < attempts; t++) {
    const slots = buildOnce(pairs, courts, t === 0 ? null : mulberry32(baseSeed + t));
    const score: [number, number] = [countBackToBack(pairs, slots), slots.length];
    if (
      score[0] < bestScore[0] ||
      (score[0] === bestScore[0] && score[1] < bestScore[1])
    ) {
      best = slots;
      bestScore = score;
    }
    if (bestScore[0] === 0 && bestScore[1] === minSlots) break;
  }

  const slots = best as number[][];
  const matches: PlannedMatch[] = [];
  slots.forEach((indices, k) => {
    const time = addMinutes(options.startTime, k * options.slotMinutes);
    [...indices]
      .sort((x, y) => x - y)
      .forEach((i, c) => {
        const p = pairs[i];
        matches.push({
          block: p.block,
          teamA: p.a,
          teamB: p.b,
          time,
          court: String(c + 1),
          slot: k,
          round: p.round,
        });
      });
  });

  return {
    matches,
    slots: slots.length,
    endTime: addMinutes(options.startTime, slots.length * options.slotMinutes),
    backToBack: bestScore[0],
  };
}
