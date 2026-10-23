import type { SupabaseClient } from "@supabase/supabase-js";
import { computeBracket } from "./bracket";
import type { Match, Team } from "./types";

// サーバー専用。リーグ戦・トーナメントの結果から決勝トーナメントの試合行を作成・更新する。
//  - 総当たりが全ブロックで終わるまでは何もしない
//  - 参加チームが変わった試合は、古いスコアを消して入れ替える
//    （勝者が変わると、その先の試合も連鎖して作り直される）
export async function syncBracket(
  sb: SupabaseClient
): Promise<{ ready: boolean; created: number; updated: number }> {
  const [teamsRes, matchesRes] = await Promise.all([
    sb.from("teams").select("*"),
    sb.from("matches").select("*"),
  ]);
  if (teamsRes.error) throw new Error(teamsRes.error.message);
  if (matchesRes.error) throw new Error(matchesRes.error.message);

  const teams = (teamsRes.data ?? []) as Team[];
  const matches = (matchesRes.data ?? []) as Match[];
  const plan = computeBracket(teams, matches);
  if (!plan.ready) return { ready: false, created: 0, updated: 0 };

  const stored = new Map<string, Match>();
  for (const m of matches) {
    if (m.round === "bracket" && m.slot) stored.set(m.slot, m);
  }

  const inserts: Record<string, unknown>[] = [];
  let updated = 0;
  for (const s of plan.slots) {
    const a = s.teamA?.id ?? null;
    const b = s.teamB?.id ?? null;
    const row = stored.get(s.slot);
    if (!row) {
      inserts.push({ round: "bracket", block: null, slot: s.slot, team_a: a, team_b: b });
    } else if (row.team_a !== a || row.team_b !== b) {
      const { error } = await sb
        .from("matches")
        .update({ team_a: a, team_b: b, score_a: null, score_b: null })
        .eq("id", row.id);
      if (error) throw new Error(error.message);
      updated++;
    }
  }
  if (inserts.length > 0) {
    const { error } = await sb.from("matches").insert(inserts);
    if (error) throw new Error(error.message);
  }
  return { ready: true, created: inserts.length, updated };
}
