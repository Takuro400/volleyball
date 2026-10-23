import { NextResponse } from "next/server";
import { isAdminRequest } from "@/lib/admin-auth";
import { syncBracket } from "@/lib/bracket-sync";
import { getAdminSupabase } from "@/lib/supabase/admin";

// 勝ち数・得失点差・総得点まで同率のチームの順位を、運営が手動で決める。
// order は上位から順に並べたチームID。先頭が1、次が2…の手動順位になる。
export async function POST(request: Request) {
  if (!(await isAdminRequest())) {
    return NextResponse.json({ error: "運営モードでログインしてください" }, { status: 403 });
  }
  const sb = getAdminSupabase();
  if (!sb) {
    return NextResponse.json({ error: "サーバーの設定が完了していません" }, { status: 500 });
  }

  const body = await request.json().catch(() => null);
  const order: unknown = body?.order;
  if (
    !Array.isArray(order) ||
    order.length < 2 ||
    order.length > 10 ||
    order.some((id) => typeof id !== "string") ||
    new Set(order).size !== order.length
  ) {
    return NextResponse.json({ error: "順位の指定が正しくありません" }, { status: 400 });
  }

  for (let i = 0; i < order.length; i++) {
    const { error } = await sb
      .from("teams")
      .update({ manual_rank: i + 1 })
      .eq("id", order[i] as string);
    if (error) {
      return NextResponse.json(
        { error: "順位の保存に失敗しました。Supabase で最新の schema.sql（追加分）を実行してください" },
        { status: 500 }
      );
    }
  }

  try {
    await syncBracket(sb);
  } catch (e) {
    console.error("syncBracket failed", e);
  }
  return NextResponse.json({ ok: true });
}
