import { NextResponse } from "next/server";
import { isAdminRequest } from "@/lib/admin-auth";
import { getAdminSupabase } from "@/lib/supabase/admin";
import type { Individual } from "@/lib/types";

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

// 運営用: 個人エントリーの一覧（名前・性別・経験者）
export async function GET() {
  const sb = await guard();
  if (sb instanceof NextResponse) return sb;
  const { data, error } = await sb
    .from("individuals")
    .select("*")
    .order("created_at", { ascending: true });
  if (error) {
    return NextResponse.json(
      { error: "取得に失敗しました。Supabase で最新の追加SQLを実行してください" },
      { status: 500 }
    );
  }
  return NextResponse.json({ individuals: (data ?? []) as Individual[] });
}

// 運営用: 個人エントリーを1件取り消す（チームに編成済みの人は、先にそのチームを削除する）
export async function DELETE(request: Request) {
  const sb = await guard();
  if (sb instanceof NextResponse) return sb;

  const body = await request.json().catch(() => null);
  const id = typeof body?.id === "string" ? body.id : null;
  if (!id) {
    return NextResponse.json({ error: "対象が見つかりません" }, { status: 400 });
  }
  const { data: row, error: readError } = await sb
    .from("individuals")
    .select("id, team_id")
    .eq("id", id)
    .maybeSingle();
  if (readError) {
    return NextResponse.json({ error: "確認に失敗しました" }, { status: 500 });
  }
  if (!row) {
    return NextResponse.json({ error: "既に削除されています" }, { status: 404 });
  }
  if (row.team_id) {
    return NextResponse.json(
      { error: "既にチームに編成されています。先にそのチームを削除してください" },
      { status: 409 }
    );
  }
  const { error } = await sb.from("individuals").delete().eq("id", id);
  if (error) {
    return NextResponse.json({ error: "削除に失敗しました" }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}
