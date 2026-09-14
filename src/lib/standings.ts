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

// ブロック内のリーグ戦結果から順位表を計算する。
// 並び順: 勝ち数 → 得失点差 → 総得点 → チーム名
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
  list.sort(
    (x, y) =>
      y.wins - x.wins ||
      y.diff - x.diff ||
      y.pointsFor - x.pointsFor ||
      x.team.name.localeCompare(y.team.name, "ja")
  );
  return list;
}

// トーナメント初戦を組める状態か: 4チーム以上いて、全チームがリーグ2試合を消化済み
export function bracketReady(standings: Standing[]): boolean {
  return standings.length >= 4 && standings.every((s) => s.played >= 2);
}
