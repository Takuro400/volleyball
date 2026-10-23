import { NextResponse } from "next/server";
import { isAdminRequest } from "@/lib/admin-auth";
import { getAdminSupabase } from "@/lib/supabase/admin";
import { generateLeague } from "@/lib/league";
import { isFinished } from "@/lib/standings";
import { BLOCKS, type Match, type Team } from "@/lib/types";

// 各ブロックの総当たりを自動生成し、時間とコートを割り当てる
export async function POST(request: Request) {
  if (!(await isAdminRequest())) {
    return NextResponse.json({ error: "運営モードでログインしてください" }, { status: 403 });
  }
  const sb = getAdminSupabase();
  if (!sb) {
    return NextResponse.json({ error: "サーバーの設定が完了していません" }, { status: 500 });
  }

  const body = await request.json().catch(() => null);
  const startTime = typeof body?.startTime === "string" ? body.startTime : "";
  const slotMinutes = Number(body?.slotMinutes);
  const courts = Number(body?.courts);
  const replace = body?.replace === true;

  const timeMatch = /^(\d{1,2}):(\d{2})$/.exec(startTime);
  if (!timeMatch || Number(timeMatch[1]) > 23 || Number(timeMatch[2]) > 59) {
    return NextResponse.json({ error: "開始時刻は「11:00」の形式で入力してください" }, { status: 400 });
  }
  if (!Number.isInteger(slotMinutes) || slotMinutes < 1 || slotMinutes > 180) {
    return NextResponse.json({ error: "1試合の枠は1〜180分で入力してください" }, { status: 400 });
  }
  if (!Number.isInteger(courts) || courts < 1 || courts > 20) {
    return NextResponse.json({ error: "コート数は1〜20で入力してください" }, { status: 400 });
  }

  const [teamsRes, matchesRes] = await Promise.all([
    sb.from("teams").select("*").order("created_at", { ascending: true }),
    sb.from("matches").select("*"),
  ]);
  if (teamsRes.error || matchesRes.error) {
    return NextResponse.json({ error: "データの取得に失敗しました" }, { status: 500 });
  }
  const teams = (teamsRes.data ?? []) as Team[];
  const existing = ((matchesRes.data ?? []) as Match[]).filter(
    (m) => m.round === "league" || m.round === "bracket"
  );

  if (teams.length === 0) {
    return NextResponse.json({ error: "エントリー済みのチームがありません" }, { status: 400 });
  }
  if (teams.some((t) => t.block === null)) {
    return NextResponse.json(
      { error: "ブロックが未割当のチームがあります。先にブロックをランダム割当してください" },
      { status: 400 }
    );
  }

  if (existing.length > 0 && !replace) {
    return NextResponse.json(
      {
        error: "既に試合が登録されています",
        existing: existing.length,
        scored: existing.filter(isFinished).length,
      },
      { status: 409 }
    );
  }

  const input = BLOCKS.map((block) => ({
    block,
    teamIds: teams.filter((t) => t.block === block).map((t) => t.id),
  })).filter((b) => b.teamIds.length >= 2);

  const plan = generateLeague(input, { startTime, slotMinutes, courts });
  if (plan.matches.length === 0) {
    return NextResponse.json({ error: "2チーム以上のブロックがありません" }, { status: 400 });
  }

  // 設定を保存（次回の初期値になる）
  const { error: settingsError } = await sb
    .from("settings")
    .upsert({ id: 1, schedule_start: startTime, slot_minutes: slotMinutes, courts });
  if (settingsError) {
    return NextResponse.json(
      { error: "設定の保存に失敗しました。Supabase で最新の schema.sql（追加分）を実行してください" },
      { status: 500 }
    );
  }

  if (existing.length > 0) {
    const { error } = await sb.from("matches").delete().in("round", ["league", "bracket"]);
    if (error) {
      return NextResponse.json({ error: "既存の試合の削除に失敗しました" }, { status: 500 });
    }
  }

  const { error: insertError } = await sb.from("matches").insert(
    plan.matches.map((m) => ({
      round: "league",
      block: m.block,
      team_a: m.teamA,
      team_b: m.teamB,
      time: m.time,
      court: m.court,
    }))
  );
  if (insertError) {
    return NextResponse.json({ error: "試合の登録に失敗しました" }, { status: 500 });
  }

  return NextResponse.json({
    ok: true,
    count: plan.matches.length,
    slots: plan.slots,
    endTime: plan.endTime,
    backToBack: plan.backToBack,
  });
}
