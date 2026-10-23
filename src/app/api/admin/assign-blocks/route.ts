import { NextResponse } from "next/server";
import { isAdminRequest } from "@/lib/admin-auth";
import { getAdminSupabase } from "@/lib/supabase/admin";
import { BLOCKS } from "@/lib/types";

// 全チームをシャッフルして A〜E ブロックへ均等に割り当てる。
// 試合が既にある場合、組み合わせが食い違うので force 指定のときだけ試合を消して再割当する。
export async function POST(request: Request) {
  if (!(await isAdminRequest())) {
    return NextResponse.json({ error: "運営モードでログインしてください" }, { status: 403 });
  }
  const sb = getAdminSupabase();
  if (!sb) {
    return NextResponse.json({ error: "サーバーの設定が完了していません" }, { status: 500 });
  }

  const body = await request.json().catch(() => null);
  const force = body?.force === true;

  const { data: teams, error } = await sb.from("teams").select("id");
  if (error) {
    return NextResponse.json({ error: "チームの取得に失敗しました" }, { status: 500 });
  }
  if (!teams || teams.length === 0) {
    return NextResponse.json({ error: "エントリー済みのチームがありません" }, { status: 400 });
  }

  const { count, error: countError } = await sb
    .from("matches")
    .select("id", { count: "exact", head: true });
  if (countError) {
    return NextResponse.json({ error: "試合の確認に失敗しました" }, { status: 500 });
  }
  if ((count ?? 0) > 0 && !force) {
    return NextResponse.json(
      { error: "既に試合が登録されています", existing: count },
      { status: 409 }
    );
  }
  if ((count ?? 0) > 0) {
    const { error: deleteError } = await sb
      .from("matches")
      .delete()
      .in("round", ["league", "bracket"]);
    if (deleteError) {
      return NextResponse.json({ error: "既存の試合の削除に失敗しました" }, { status: 500 });
    }
  }

  const shuffled = [...teams];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }

  for (let i = 0; i < shuffled.length; i++) {
    const block = BLOCKS[i % BLOCKS.length];
    const { error: updateError } = await sb
      .from("teams")
      .update({ block, manual_rank: null })
      .eq("id", shuffled[i].id);
    if (updateError) {
      return NextResponse.json(
        { error: "割当の保存に失敗しました。Supabase で最新の schema.sql（追加分）を実行してください" },
        { status: 500 }
      );
    }
  }
  return NextResponse.json({ ok: true, count: shuffled.length });
}
