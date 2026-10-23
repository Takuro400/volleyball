import {
  BLOCKS,
  type Block,
  type Match,
  type SlotId,
  type Team,
} from "./types";
import {
  blockComplete,
  compareStandings,
  computeStandings,
  findTieGroups,
  isFinished,
  type Standing,
  type TieGroup,
} from "./standings";

// 決勝トーナメント（10チーム・ブロック横断の1本のトーナメント）
//
//   1回戦    : 7位 vs 10位（R1-1）/ 8位 vs 9位（R1-2）
//   準々決勝 : 1位 vs R1-2勝者（QF1）/ 2位 vs R1-1勝者（QF2）/ 3位 vs 6位（QF3）/ 4位 vs 5位（QF4）
//   準決勝   : QF1勝者 vs QF4勝者（SF1）/ QF2勝者 vs QF3勝者（SF2）
//   決勝     : SF1勝者 vs SF2勝者（F）

export const SLOT_IDS: SlotId[] = [
  "R1-1",
  "R1-2",
  "QF1",
  "QF2",
  "QF3",
  "QF4",
  "SF1",
  "SF2",
  "F",
];

export type RoundKey = "R1" | "QF" | "SF" | "F";

export const ROUND_OF: Record<SlotId, RoundKey> = {
  "R1-1": "R1",
  "R1-2": "R1",
  QF1: "QF",
  QF2: "QF",
  QF3: "QF",
  QF4: "QF",
  SF1: "SF",
  SF2: "SF",
  F: "F",
};

export const ROUND_LABEL: Record<RoundKey, string> = {
  R1: "1回戦",
  QF: "準々決勝",
  SF: "準決勝",
  F: "決勝",
};

export const SLOT_LABEL: Record<SlotId, string> = {
  "R1-1": "1回戦 第1試合",
  "R1-2": "1回戦 第2試合",
  QF1: "準々決勝 第1試合",
  QF2: "準々決勝 第2試合",
  QF3: "準々決勝 第3試合",
  QF4: "準々決勝 第4試合",
  SF1: "準決勝 第1試合",
  SF2: "準決勝 第2試合",
  F: "決勝",
};

export type Seed = {
  seed: number; // 1〜10
  standing: Standing;
  block: Block;
  blockRank: 1 | 2; // ブロック内の順位
};

export type SlotPlan = {
  slot: SlotId;
  teamA: Team | null;
  teamB: Team | null;
  // 参加チームが未確定のときに表示する説明（例: 「1回戦 第2試合の勝者」）
  labelA: string;
  labelB: string;
  // 保存済みの試合。参加チームが現在の組み合わせと一致するときだけ入る
  match: Match | null;
  winner: Team | null;
};

export type TieNeed = {
  title: string;
  group: TieGroup;
};

export type BracketPlan = {
  // 全ブロックの総当たりが終わり、順位の同率も解消済み
  ready: boolean;
  leagueFinished: number;
  leagueTotal: number;
  incompleteBlocks: Block[];
  // 運営の手動順位が必要な同率
  ties: TieNeed[];
  seeds: Seed[];
  slots: SlotPlan[];
  champion: Team | null;
};

function winnerOf(m: Match | null, a: Team | null, b: Team | null): Team | null {
  if (!m || !a || !b || !isFinished(m)) return null;
  if (m.score_a === m.score_b) return null;
  return (m.score_a as number) > (m.score_b as number) ? a : b;
}

export function computeBracket(teams: Team[], matches: Match[]): BracketPlan {
  const perBlock = BLOCKS.map((block) => ({
    block,
    standings: computeStandings(teams, matches, block),
  }));

  const leagueTotal = perBlock.reduce((sum, p) => {
    const n = p.standings.length;
    return sum + (n * (n - 1)) / 2;
  }, 0);
  const leagueFinished = matches.filter(
    (m) => m.round === "league" && isFinished(m)
  ).length;
  const incompleteBlocks = perBlock
    .filter((p) => !blockComplete(p.standings))
    .map((p) => p.block);

  const empty = (ties: TieNeed[]): BracketPlan => ({
    ready: false,
    leagueFinished,
    leagueTotal,
    incompleteBlocks,
    ties,
    seeds: [],
    slots: buildSlots([], matches),
    champion: null,
  });

  if (incompleteBlocks.length > 0) return empty([]);

  // 同率の手動決定が必要なものを集める
  const ties: TieNeed[] = [];
  for (const p of perBlock) {
    for (const g of findTieGroups(p.standings)) {
      // 上位2チームの境目（2位と3位）または1位と2位にまたがる同率だけが影響する
      const end = g.startIndex + g.standings.length - 1;
      if (g.startIndex <= 1 && end >= 1 && !g.resolved) {
        ties.push({ title: `ブロック${p.block}の順位`, group: g });
      }
    }
  }

  const firsts = perBlock.map((p) => ({ s: p.standings[0], block: p.block }));
  const seconds = perBlock.map((p) => ({ s: p.standings[1], block: p.block }));
  firsts.sort((x, y) => compareStandings(x.s, y.s));
  seconds.sort((x, y) => compareStandings(x.s, y.s));

  for (const g of findTieGroups(firsts.map((f) => f.s))) {
    if (!g.resolved) ties.push({ title: "各ブロック1位の比較（シード1〜5位）", group: g });
  }
  for (const g of findTieGroups(seconds.map((f) => f.s))) {
    if (!g.resolved) ties.push({ title: "各ブロック2位の比較（シード6〜10位）", group: g });
  }

  if (ties.length > 0) return empty(ties);

  const seeds: Seed[] = [
    ...firsts.map((f, i) => ({
      seed: i + 1,
      standing: f.s,
      block: f.block,
      blockRank: 1 as const,
    })),
    ...seconds.map((f, i) => ({
      seed: i + 6,
      standing: f.s,
      block: f.block,
      blockRank: 2 as const,
    })),
  ];

  const slots = buildSlots(seeds, matches);
  const final = slots.find((s) => s.slot === "F");
  return {
    ready: true,
    leagueFinished,
    leagueTotal,
    incompleteBlocks: [],
    ties: [],
    seeds,
    slots,
    champion: final?.winner ?? null,
  };
}

function buildSlots(seeds: Seed[], matches: Match[]): SlotPlan[] {
  const seedTeam = (n: number): Team | null => seeds[n - 1]?.standing.team ?? null;
  const stored = new Map<SlotId, Match>();
  for (const m of matches) {
    if (m.round === "bracket" && m.slot) stored.set(m.slot, m);
  }

  const plans = new Map<SlotId, SlotPlan>();
  const build = (
    slot: SlotId,
    a: Team | null,
    b: Team | null,
    labelA: string,
    labelB: string
  ): SlotPlan => {
    const row = stored.get(slot) ?? null;
    // 保存済みの試合は、参加チームが今の組み合わせと同じときだけ有効（違えば作り直し待ち）
    const valid =
      row && row.team_a === (a?.id ?? null) && row.team_b === (b?.id ?? null)
        ? row
        : null;
    const plan: SlotPlan = {
      slot,
      teamA: a,
      teamB: b,
      labelA,
      labelB,
      match: valid,
      winner: winnerOf(valid, a, b),
    };
    plans.set(slot, plan);
    return plan;
  };
  const w = (slot: SlotId) => plans.get(slot)?.winner ?? null;
  const seedLabel = (n: number) => `シード${n}位`;

  build("R1-1", seedTeam(7), seedTeam(10), seedLabel(7), seedLabel(10));
  build("R1-2", seedTeam(8), seedTeam(9), seedLabel(8), seedLabel(9));
  build("QF1", seedTeam(1), w("R1-2"), seedLabel(1), "1回戦 第2試合の勝者");
  build("QF2", seedTeam(2), w("R1-1"), seedLabel(2), "1回戦 第1試合の勝者");
  build("QF3", seedTeam(3), seedTeam(6), seedLabel(3), seedLabel(6));
  build("QF4", seedTeam(4), seedTeam(5), seedLabel(4), seedLabel(5));
  build("SF1", w("QF1"), w("QF4"), "準々決勝 第1試合の勝者", "準々決勝 第4試合の勝者");
  build("SF2", w("QF2"), w("QF3"), "準々決勝 第2試合の勝者", "準々決勝 第3試合の勝者");
  build("F", w("SF1"), w("SF2"), "準決勝 第1試合の勝者", "準決勝 第2試合の勝者");

  return SLOT_IDS.map((id) => plans.get(id) as SlotPlan);
}
