import { NextResponse } from "next/server";
import { isAdminRequest } from "@/lib/admin-auth";
import { getAdminSupabase } from "@/lib/supabase/admin";
import { isBlock } from "@/lib/types";

async function guard() {
  if (!(await isAdminRequest())) {
    return NextResponse.json({ error: "運営モードでログインしてください" }, { status: 403 });
  }
  const sb = getAdminSupabase();
  if (!sb) {
    return NextResponse.json({ error: "サーバーの設定が完了していません" }, { status: 500 });
  }
  return sb;
}

function parseScore(v: unknown): number | null | undefined {
  if (v === undefined) return undefined; // 変更しない
  if (v === null || v === "") return null; // 未入力に戻す
  const n = Number(v);
  if (!Number.isInteger(n) || n < 0 || n > 99) return undefined;
  return n;
}

// 対戦カード作成
export async function POST(request: Request) {
  const sb = await guard();
  if (sb instanceof NextResponse) return sb;

  const body = await request.json().catch(() => null);
  const round = body?.round === "bracket" ? "bracket" : "league";
  const block = isBlock(body?.block) ? body.block : null;
  const teamA = typeof body?.teamA === "string" ? body.teamA : null;
  const teamB = typeof body?.teamB === "string" ? body.teamB : null;
  const time = typeof body?.time === "string" && body.time ? body.time : null;
  const court = typeof body?.court === "string" && body.court ? body.court : null;

  if (!teamA || !teamB || teamA === teamB) {
    return NextResponse.json(
      { error: "異なる2チームを選択してください" },
      { status: 400 }
    );
  }

  const { data, error } = await sb
    .from("matches")
    .insert({ round, block, team_a: teamA, team_b: teamB, time, court })
    .select()
    .single();
  if (error) {
    return NextResponse.json({ error: "登録に失敗しました" }, { status: 500 });
  }
  return NextResponse.json({ match: data });
}

// スコア・時間・コートの更新
export async function PATCH(request: Request) {
  const sb = await guard();
  if (sb instanceof NextResponse) return sb;

  const body = await request.json().catch(() => null);
  const id = typeof body?.id === "string" ? body.id : null;
  if (!id) {
    return NextResponse.json({ error: "対象の試合が見つかりません" }, { status: 400 });
  }

  const update: Record<string, unknown> = {};
  const scoreA = parseScore(body?.scoreA);
  const scoreB = parseScore(body?.scoreB);
  if (scoreA !== undefined) update.score_a = scoreA;
  if (scoreB !== undefined) update.score_b = scoreB;
  if (body?.time !== undefined) update.time = body.time || null;
  if (body?.court !== undefined) update.court = body.court || null;

  if (Object.keys(update).length === 0) {
    return NextResponse.json({ error: "更新内容がありません" }, { status: 400 });
  }

  const { data, error } = await sb
    .from("matches")
    .update(update)
    .eq("id", id)
    .select()
    .single();
  if (error) {
    return NextResponse.json({ error: "更新に失敗しました" }, { status: 500 });
  }
  return NextResponse.json({ match: data });
}

export async function DELETE(request: Request) {
  const sb = await guard();
  if (sb instanceof NextResponse) return sb;

  const body = await request.json().catch(() => null);
  const id = typeof body?.id === "string" ? body.id : null;
  if (!id) {
    return NextResponse.json({ error: "対象の試合が見つかりません" }, { status: 400 });
  }
  const { error } = await sb.from("matches").delete().eq("id", id);
  if (error) {
    return NextResponse.json({ error: "削除に失敗しました" }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}
