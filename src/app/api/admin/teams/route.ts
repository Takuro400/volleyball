import { NextResponse } from "next/server";
import { isAdminRequest } from "@/lib/admin-auth";
import { syncBracket } from "@/lib/bracket-sync";
import { getAdminSupabase } from "@/lib/supabase/admin";

// チームの削除（重複登録・間違い登録の取り消し用）。
// そのチームの試合が既にあるときは、試合と結果も一緒に消えるため force 指定が必要。
export async function DELETE(request: Request) {
  if (!(await isAdminRequest())) {
    return NextResponse.json({ error: "運営モードでログインしてください" }, { status: 403 });
  }
  const sb = getAdminSupabase();
  if (!sb) {
    return NextResponse.json({ error: "サーバーの設定が完了していません" }, { status: 500 });
  }

  const body = await request.json().catch(() => null);
  const id = typeof body?.id === "string" ? body.id : null;
  const force = body?.force === true;
  if (!id) {
    return NextResponse.json({ error: "対象のチームが見つかりません" }, { status: 400 });
  }

  const { data: team, error: teamError } = await sb
    .from("teams")
    .select("id, name")
    .eq("id", id)
    .maybeSingle();
  if (teamError) {
    return NextResponse.json({ error: "チームの確認に失敗しました" }, { status: 500 });
  }
  if (!team) {
    return NextResponse.json({ error: "このチームは既に削除されています" }, { status: 404 });
  }

  const [asA, asB] = await Promise.all([
    sb.from("matches").select("id", { count: "exact", head: true }).eq("team_a", id),
    sb.from("matches").select("id", { count: "exact", head: true }).eq("team_b", id),
  ]);
  if (asA.error || asB.error) {
    return NextResponse.json({ error: "試合の確認に失敗しました" }, { status: 500 });
  }
  const matches = (asA.count ?? 0) + (asB.count ?? 0);

  if (matches > 0 && !force) {
    return NextResponse.json(
      { error: "このチームの試合が既にあります", matches, name: team.name },
      { status: 409 }
    );
  }

  // 試合は外部キーの cascade でも消えるが、分かりやすいよう明示的に先に消す
  if (matches > 0) {
    const [a, b] = await Promise.all([
      sb.from("matches").delete().eq("team_a", id),
      sb.from("matches").delete().eq("team_b", id),
    ]);
    if (a.error || b.error) {
      return NextResponse.json({ error: "試合の削除に失敗しました" }, { status: 500 });
    }
  }

  const { error } = await sb.from("teams").delete().eq("id", id);
  if (error) {
    return NextResponse.json({ error: "チームの削除に失敗しました" }, { status: 500 });
  }

  try {
    await syncBracket(sb);
  } catch (e) {
    console.error("syncBracket failed", e);
  }
  return NextResponse.json({ ok: true, name: team.name, deletedMatches: matches });
}
