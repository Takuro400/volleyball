import { NextResponse } from "next/server";
import { getAdminSupabase } from "@/lib/supabase/admin";
import { INDIVIDUAL_LIMIT } from "@/lib/types";

// 個人エントリーの人数だけを公開する（名前などは返さない）
export async function GET() {
  const sb = getAdminSupabase();
  if (!sb) {
    return NextResponse.json({ error: "サーバーの設定が完了していません" }, { status: 500 });
  }
  const { count, error } = await sb
    .from("individuals")
    .select("id", { count: "exact", head: true });
  if (error) {
    return NextResponse.json({ error: "取得に失敗しました" }, { status: 500 });
  }
  return NextResponse.json(
    { count: count ?? 0, limit: INDIVIDUAL_LIMIT },
    { headers: { "Cache-Control": "no-store" } }
  );
}
