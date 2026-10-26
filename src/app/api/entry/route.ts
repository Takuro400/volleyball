import { NextResponse } from "next/server";
import { getAdminSupabase } from "@/lib/supabase/admin";
import { TEAM_ENTRY_LIMIT, type Member } from "@/lib/types";

// チームエントリー（一般ユーザーも可）
export async function POST(request: Request) {
  const sb = getAdminSupabase();
  if (!sb) {
    return NextResponse.json(
      { error: "サーバーの設定が完了していません" },
      { status: 500 }
    );
  }

  const body = await request.json().catch(() => null);
  const name = typeof body?.name === "string" ? body.name.trim() : "";
  const rawMembers = Array.isArray(body?.members) ? body.members : [];

  if (!name) {
    return NextResponse.json({ error: "チーム名を入力してください" }, { status: 400 });
  }
  if (name.length > 30) {
    return NextResponse.json({ error: "チーム名は30文字以内にしてください" }, { status: 400 });
  }
  if (rawMembers.length < 1 || rawMembers.length > 15) {
    return NextResponse.json({ error: "メンバーは1〜15人で入力してください" }, { status: 400 });
  }

  const members: Member[] = [];
  for (const m of rawMembers) {
    const memberName = typeof m?.name === "string" ? m.name.trim() : "";
    if (!memberName || memberName.length > 30) {
      return NextResponse.json(
        { error: "メンバー全員の名前を30文字以内で入力してください" },
        { status: 400 }
      );
    }
    members.push({ name: memberName, isLeader: m?.isLeader === true });
  }
  if (members.filter((m) => m.isLeader).length !== 1) {
    return NextResponse.json(
      { error: "リーダーを1人選択してください" },
      { status: 400 }
    );
  }

  // チームでのエントリーは15チームまで（残り5チームは、個人・少人数エントリーから当日編成する）。
  // 追加列(kind)がまだ無いデータベースでは確認に失敗するので、その場合は上限チェックを行わない。
  const { count: entryCount, error: countError } = await sb
    .from("teams")
    .select("id", { count: "exact", head: true })
    .eq("kind", "entry");
  if (!countError && (entryCount ?? 0) >= TEAM_ENTRY_LIMIT) {
    return NextResponse.json(
      {
        error: `チームでのエントリーは${TEAM_ENTRY_LIMIT}チームで締め切りました。「当日チーム分けで参加」からエントリーしてください`,
        full: true,
      },
      { status: 409 }
    );
  }

  const { data, error } = await sb
    .from("teams")
    .insert({ name, block: null, members })
    .select()
    .single();
  if (error) {
    return NextResponse.json({ error: "登録に失敗しました" }, { status: 500 });
  }
  return NextResponse.json({ team: data });
}
