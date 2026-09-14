import { NextResponse } from "next/server";
import { isAdminRequest } from "@/lib/admin-auth";
import { getAdminSupabase } from "@/lib/supabase/admin";
import { BLOCKS } from "@/lib/types";

// 全チームをシャッフルして A〜E ブロックへ均等に割り当てる
export async function POST() {
  if (!(await isAdminRequest())) {
    return NextResponse.json({ error: "運営モードでログインしてください" }, { status: 403 });
  }
  const sb = getAdminSupabase();
  if (!sb) {
    return NextResponse.json({ error: "サーバーの設定が完了していません" }, { status: 500 });
  }

  const { data: teams, error } = await sb.from("teams").select("id");
  if (error) {
    return NextResponse.json({ error: "チームの取得に失敗しました" }, { status: 500 });
  }
  if (!teams || teams.length === 0) {
    return NextResponse.json({ error: "エントリー済みのチームがありません" }, { status: 400 });
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
      .update({ block })
      .eq("id", shuffled[i].id);
    if (updateError) {
      return NextResponse.json({ error: "割当の保存に失敗しました" }, { status: 500 });
    }
  }
  return NextResponse.json({ ok: true, count: shuffled.length });
}
