import { GUERRILLA_MAX_SIZE, GUERRILLA_MIN_SIZE } from "./types";

// 個人・少人数エントリーを、当日ランダムにチームへ振り分ける。
// 一緒にエントリーした人（グループ）は絶対に分けない。
// グループの大きさはまちまち(1〜3人)なので、全チームがぴったり同じ人数になるとは限らない。
// そこで「各チームが6〜8人に収まり、人数の差が小さい」分け方を、ランダムに多数試して選ぶ。

export type SplitGroup = { key: string; size: number };

export type SplitResult = {
  // チームごとの、入るグループのkey
  teams: string[][];
  sizes: number[];
  // 6人未満・8人超のチームがある、など注意が必要な点
  warnings: string[];
  cost: number;
};

function costOf(sizes: number[], total: number): number {
  const target = total / sizes.length;
  let c = 0;
  for (const s of sizes) {
    c += (s - target) ** 2;
    if (s < GUERRILLA_MIN_SIZE) c += 1000 * (GUERRILLA_MIN_SIZE - s);
    if (s > GUERRILLA_MAX_SIZE) c += 1000 * (s - GUERRILLA_MAX_SIZE);
  }
  return c;
}

function shuffle<T>(arr: T[], rng: () => number): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export function splitIntoTeams(
  groups: SplitGroup[],
  teamCount: number,
  rng: () => number = Math.random,
  attempts = 600
): SplitResult {
  const T = Math.max(1, Math.floor(teamCount));
  const total = groups.reduce((s, g) => s + g.size, 0);

  let best: { bins: SplitGroup[][]; cost: number } | null = null;
  let tiesAtBest = 0;

  for (let a = 0; a < attempts; a++) {
    // 大きいグループから順に、いちばん人数の少ないチームへ入れる（同じ大きさ・同じ人数はランダム）
    const order = shuffle(groups, rng).sort((x, y) => y.size - x.size);
    const bins: SplitGroup[][] = Array.from({ length: T }, () => []);
    const sizes = new Array<number>(T).fill(0);
    for (const g of order) {
      const min = Math.min(...sizes);
      const candidates = sizes.map((s, i) => (s === min ? i : -1)).filter((i) => i >= 0);
      const pick = candidates[Math.floor(rng() * candidates.length)];
      bins[pick].push(g);
      sizes[pick] += g.size;
    }

    // 局所改善: グループの移動・入れ替えで、コストが下がるなら採用
    let cost = costOf(sizes, total);
    for (let step = 0; step < 150; step++) {
      const from = Math.floor(rng() * T);
      const to = Math.floor(rng() * T);
      if (from === to || bins[from].length === 0) continue;
      const gi = Math.floor(rng() * bins[from].length);
      const g = bins[from][gi];
      if (bins[to].length > 0 && rng() < 0.5) {
        const hi = Math.floor(rng() * bins[to].length);
        const h = bins[to][hi];
        const next = [...sizes];
        next[from] += h.size - g.size;
        next[to] += g.size - h.size;
        const c = costOf(next, total);
        if (c < cost) {
          bins[from][gi] = h;
          bins[to][hi] = g;
          sizes[from] = next[from];
          sizes[to] = next[to];
          cost = c;
        }
      } else {
        const next = [...sizes];
        next[from] -= g.size;
        next[to] += g.size;
        const c = costOf(next, total);
        if (c < cost) {
          bins[from].splice(gi, 1);
          bins[to].push(g);
          sizes[from] = next[from];
          sizes[to] = next[to];
          cost = c;
        }
      }
    }

    if (best === null || cost < best.cost - 1e-9) {
      best = { bins: bins.map((b) => [...b]), cost };
      tiesAtBest = 1;
    } else if (Math.abs(cost - best.cost) < 1e-9) {
      // 同じ良さの分け方が複数あるときは、どれも等確率で選ぶ
      tiesAtBest++;
      if (rng() < 1 / tiesAtBest) best = { bins: bins.map((b) => [...b]), cost };
    }
  }

  const bins = (best as { bins: SplitGroup[][]; cost: number }).bins;
  const order = shuffle(bins.map((_, i) => i), rng); // チームの並び順(チーム番号)もランダムに
  const teams = order.map((i) => bins[i].map((g) => g.key));
  const sizes = order.map((i) => bins[i].reduce((s, g) => s + g.size, 0));

  const warnings: string[] = [];
  sizes.forEach((s, i) => {
    if (s < GUERRILLA_MIN_SIZE) {
      warnings.push(`チーム${i + 1}が${s}人で、${GUERRILLA_MIN_SIZE}人に満たしません（試合ができません）`);
    }
    if (s > GUERRILLA_MAX_SIZE) {
      warnings.push(`チーム${i + 1}が${s}人で、${GUERRILLA_MAX_SIZE}人を超えています`);
    }
  });
  if (warnings.length > 0) {
    warnings.push("「やり直す」を押すか、チーム数を変えてみてください。");
  }
  return { teams, sizes, warnings, cost: (best as { cost: number }).cost };
}
