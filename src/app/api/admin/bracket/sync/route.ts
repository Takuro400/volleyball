import { NextResponse } from "next/server";
import { isAdminRequest } from "@/lib/admin-auth";
import { syncBracket } from "@/lib/bracket-sync";
import { getAdminSupabase } from "@/lib/supabase/admin";

// 決勝トーナメントの試合を、現在の順位・結果に合わせて作成・更新する
export async function POST() {
  if (!(await isAdminRequest())) {
    return NextResponse.json({ error: "運営モードでログインしてください" }, { status: 403 });
  }
  const sb = getAdminSupabase();
  if (!sb) {
    return NextResponse.json({ error: "サーバーの設定が完了していません" }, { status: 500 });
  }
  try {
    return NextResponse.json(await syncBracket(sb));
  } catch {
    return NextResponse.json(
      { error: "トーナメントの更新に失敗しました。Supabase で最新の schema.sql（追加分）を実行してください" },
      { status: 500 }
    );
  }
}
