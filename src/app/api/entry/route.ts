import { NextResponse } from "next/server";
import { isAdminRequest } from "@/lib/admin-auth";
import { createTeamEntry, getEntryMode } from "@/lib/entry-core";
import { getAdminSupabase } from "@/lib/supabase/admin";

// アプリ内のフォームからのチームエントリー。
// 受付方法が「Googleフォーム」のときは、運営(ログイン済み)だけが当日の手入力などに使える。
export async function POST(request: Request) {
  const sb = getAdminSupabase();
  if (!sb) {
    return NextResponse.json({ error: "サーバーの設定が完了していません" }, { status: 500 });
  }
  if ((await getEntryMode(sb)) !== "app" && !(await isAdminRequest())) {
    return NextResponse.json(
      { error: "エントリーは Google フォームから受け付けています", closed: true },
      { status: 403 }
    );
  }

  const body = await request.json().catch(() => null);
  const result = await createTeamEntry(sb, { name: body?.name, members: body?.members });
  if (!result.ok) {
    return NextResponse.json({ error: result.message, ...result.extra }, { status: result.status });
  }
  return NextResponse.json({ team: result.team });
}
