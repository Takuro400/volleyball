import type { Block, Match, Team } from "./types";

export type Standing = {
  team: Team;
  played: number;
  wins: number;
  losses: number;
  pointsFor: number;
  pointsAgainst: number;
  diff: number;
};

export function isFinished(m: Match): boolean {
  return m.score_a !== null && m.score_b !== null;
}

const manualRank = (t: Team) => t.manual_rank ?? Number.POSITIVE_INFINITY;

// 順位の比較: 勝ち数 → 得失点差 → 総得点 → 運営の手動順位。
// 手動順位も無いときは表示が安定するようチーム名で並べる（この場合は「同率」として扱う）。
export function compareStandings(x: Standing, y: Standing): number {
  if (y.wins !== x.wins) return y.wins - x.wins;
  if (y.diff !== x.diff) return y.diff - x.diff;
  if (y.pointsFor !== x.pointsFor) return y.pointsFor - x.pointsFor;
  const rx = manualRank(x.team);
  const ry = manualRank(y.team);
  if (rx !== ry) return rx < ry ? -1 : 1;
  return (
    x.team.name.localeCompare(y.team.name, "ja") ||
    x.team.id.localeCompare(y.team.id)
  );
}

// ブロック内のリーグ戦結果から順位表を計算する。
export function computeStandings(
  teams: Team[],
  matches: Match[],
  block: Block
): Standing[] {
  const blockTeams = teams.filter((t) => t.block === block);
  const rows = new Map<string, Standing>(
    blockTeams.map((team) => [
      team.id,
      { team, played: 0, wins: 0, losses: 0, pointsFor: 0, pointsAgainst: 0, diff: 0 },
    ])
  );

  for (const m of matches) {
    if (m.round !== "league" || m.block !== block || !isFinished(m)) continue;
    const a = m.team_a ? rows.get(m.team_a) : undefined;
    const b = m.team_b ? rows.get(m.team_b) : undefined;
    if (!a || !b) continue;
    const sa = m.score_a as number;
    const sb = m.score_b as number;
    a.played += 1;
    b.played += 1;
    a.pointsFor += sa;
    a.pointsAgainst += sb;
    b.pointsFor += sb;
    b.pointsAgainst += sa;
    if (sa > sb) {
      a.wins += 1;
      b.losses += 1;
    } else if (sb > sa) {
      b.wins += 1;
      a.losses += 1;
    }
  }

  const list = [...rows.values()];
  for (const r of list) r.diff = r.pointsFor - r.pointsAgainst;
  list.sort(compareStandings);
  return list;
}

// 総当たりが終わったブロックか（全チームが「他の全チーム」と対戦済み）
export function blockComplete(standings: Standing[]): boolean {
  return (
    standings.length >= 2 &&
    standings.every((s) => s.played >= standings.length - 1)
  );
}

export type TieGroup = {
  // 並べ替え済みの順位表のうち、完全に同率のチーム
  standings: Standing[];
  // 元の順位表での先頭の位置（0始まり）
  startIndex: number;
  // 全員に重複しない手動順位がついていれば決定済み
  resolved: boolean;
};

const sameRecord = (a: Standing, b: Standing) =>
  a.wins === b.wins && a.diff === b.diff && a.pointsFor === b.pointsFor;

// 勝ち数・得失点差・総得点が全く同じチームのグループを探す（2チーム以上）
export function findTieGroups(sorted: Standing[]): TieGroup[] {
  const groups: TieGroup[] = [];
  let i = 0;
  while (i < sorted.length) {
    let j = i + 1;
    while (j < sorted.length && sameRecord(sorted[i], sorted[j])) j++;
    if (j - i > 1) {
      const members = sorted.slice(i, j);
      const ranks = members.map((s) => s.team.manual_rank);
      const resolved =
        ranks.every((r) => r !== null) && new Set(ranks).size === ranks.length;
      groups.push({ standings: members, startIndex: i, resolved });
    }
    i = j;
  }
  return groups;
}
